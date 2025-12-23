// src/listener.js
const { ethers } = require('ethers');
const { db, getMeta, setMeta } = require('./db');
const { providerUrl, confirmations } = require('./config');

const provider = new ethers.JsonRpcProvider(providerUrl);

const BLOCK_PROCESSING_INTERVAL = 15000; // 15 seconds
const MAX_BLOCKS_PER_BATCH = 5;
let isProcessing = false;
const LAST_DEPOSIT_BLOCK = 68414540;

// -------------------- User lookup --------------------
async function getUserByAddress(address, retries = 3) {
    if (!address || typeof address !== 'string') return null;

    let cleanedAddress = address.normalize('NFD').trim();
    cleanedAddress = cleanedAddress.replace(/[\u0000-\u001F\u0080-\u009F]/g, '');
    const addressRegex = /^0x[0-9a-fA-F]{40}$/i;

    if (!addressRegex.test(cleanedAddress)) return null;

    const finalAddress = cleanedAddress.toLowerCase();

    for (let i = 0; i < retries; i++) {
        try {
            const result = await db.query(
                `SELECT u.* 
                 FROM users u
                 JOIN deposit_addresses d ON d.user_id = u.id
                 WHERE LOWER(d.wallet_address) = '${finalAddress}'`
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Error getting user by address (attempt ${i + 1}):`, error);
            if (i === retries - 1) return null;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// -------------------- Credit user --------------------
async function creditDeposit(userId, amountRaw, txHash, token = 'BTCB', decimals = 18) {
    if (!amountRaw) return false;

    let amountDisplay;
    try {
        amountDisplay = ethers.formatUnits(amountRaw, decimals);

        if (parseFloat(amountDisplay) === 0) {
            console.warn(`⚠️ Skipping zero amount for user ${userId}, tx: ${txHash}`);
            return false;
        }

        console.log(`DEBUG: log.data=${amountRaw}, amountDisplay=${amountDisplay} ${token}`);
    } catch (e) {
        console.error(`Error in creditDeposit: ${e.name}: ${e.message}`);
        console.warn(`Skipping invalid amount: ${amountRaw}`);
        return false;
    }

    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');

        const userRes = await client.query(
            'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (userRes.rowCount === 0) throw new Error('User not found when crediting');

        const previousBalance = parseFloat(userRes.rows[0].balance || '0');
        const newBalance = (previousBalance + parseFloat(amountDisplay)).toString();

        await client.query(
            'UPDATE users SET balance = $1 WHERE id = $2',
            [newBalance, userId]
        );

        await client.query(
            `INSERT INTO transactions (user_id, tx_hash, amount, type, status, currency)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, txHash, amountDisplay, 'deposit', 'confirmed', token]
        );

        await client.query('COMMIT');

        console.log(`✅ Credited ${amountDisplay} ${token} to user ${userId} (tx: ${txHash}). Previous balance: ${previousBalance}, New balance: ${newBalance}`);
        return true;
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error in creditDeposit during DB transaction:', error);
        return false;
    } finally {
        if (client) client.release();
    }
}

// -------------------- Fetch block --------------------
async function getBlockWithTransactions(blockNumber) {
    try {
        return await provider.getBlock(blockNumber, true);
    } catch (error) {
        console.error(`Error fetching block ${blockNumber}:`, error);
        return null;
    }
}

// -------------------- Process block batch --------------------
async function processBlockBatch(startBlock, endBlock) {
    let lastProcessed = startBlock - 1;

    for (let bn = startBlock; bn <= endBlock; bn++) {
        const block = await getBlockWithTransactions(bn);
        if (!block) {
            console.log(`Block ${bn} not found`);
            await setMeta('last_processed_block', String(bn));
            continue;
        }

        // --- Process native BNB transactions ---
        for (const tx of block.transactions) {
            try {
                if (!tx.to || !tx.value || tx.value.toString() === '0') continue;

                console.log(`CHECKING BNB TX | To: ${tx.to} | Hash: ${tx.hash}`);

                const user = await getUserByAddress(tx.to);
                if (!user) continue;

                await creditDeposit(user.id, tx.value, tx.hash, 'BNB', 18);
            } catch (txError) {
                console.error(`Error processing BNB tx ${tx.hash} in block ${bn}:`, txError);
            }
        }

        // --- Process BEP-20 token transfers ---
        try {
            const logs = await provider.getLogs({
                fromBlock: bn,
                toBlock: bn,
                topics: [ethers.id("Transfer(address,address,uint256)")],
            });

            for (const log of logs) {
                if (!log.data || log.data === '0x') continue;

                const to = `0x${log.topics[2].slice(26)}`;
                console.log(`CHECKING TOKEN LOG | Token: ${log.address} | To: ${to} | Hash: ${log.transactionHash}`);

                const user = await getUserByAddress(to);
                if (!user) continue;

                let decimals = 18;
                try {
                    const tokenContract = new ethers.Contract(
                        log.address,
                        ["function decimals() view returns (uint8)"],
                        provider
                    );
                    decimals = Number(await tokenContract.decimals());
                } catch {
                    console.warn(`Could not fetch decimals for token ${log.address}, defaulting to 18`);
                }

                await creditDeposit(user.id, log.data, log.transactionHash, 'BTCB', decimals);
            }
        } catch (tokenError) {
            console.error(`Error processing BEP-20 logs in block ${bn}:`, tokenError);
        }

        lastProcessed = bn;
        await setMeta('last_processed_block', String(bn));
    }

    return { lastProcessed };
}

// -------------------- Process all new blocks --------------------
async function processBlocks() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        const currentBlock = await provider.getBlockNumber();
        const targetBlock = currentBlock - (confirmations - 1);

        let lastProcessed = parseInt(await getMeta('last_processed_block') || '0', 10);
        if (lastProcessed < LAST_DEPOSIT_BLOCK) {
            lastProcessed = LAST_DEPOSIT_BLOCK;
            await setMeta('last_processed_block', String(lastProcessed));
            console.log(`Starting from last known deposit block ${LAST_DEPOSIT_BLOCK}`);
        }

        if (lastProcessed >= targetBlock) {
            console.log('No new blocks to process');
            return;
        }

        console.log(`Processing blocks ${lastProcessed + 1} to ${targetBlock}`);

        let start = lastProcessed + 1;
        while (start <= targetBlock) {
            const end = Math.min(start + MAX_BLOCKS_PER_BATCH - 1, targetBlock);
            const result = await processBlockBatch(start, end);
            start = result.lastProcessed + 1;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('Error in processBlocks:', error);
    } finally {
        isProcessing = false;
    }
}

// -------------------- Start listener --------------------
function startListener() {
    setTimeout(processBlocks, 1000);
    setInterval(processBlocks, BLOCK_PROCESSING_INTERVAL);
    console.log('Block listener started');
}

module.exports = { startListener };
