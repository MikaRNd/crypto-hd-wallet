// src/listener.js
const { ethers } = require('ethers');
const { db, getMeta, setMeta } = require('./db');
const { providerUrl, confirmations } = require('./config');

const provider = new ethers.JsonRpcProvider(providerUrl);

const BLOCK_PROCESSING_INTERVAL = 15000; // 15 seconds
const MAX_BLOCKS_PER_BATCH = 5;
let isProcessing = false;
const LAST_DEPOSIT_BLOCK = 68414541;

// -------------------- User lookup --------------------
async function getUserByAddress(address) {
  try {
    const result = await db.query(
      `SELECT u.*
       FROM users u
       JOIN deposit_addresses d ON d.user_id = u.id
       WHERE LOWER(d.wallet_address) = $1`,
      [address.toLowerCase()]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user by address:', error);
    return null;
  }
}

// -------------------- Credit user --------------------
async function creditDeposit(userId, amountWei, txHash, token = 'ETH') {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (userRes.rowCount === 0) throw new Error('User not found when crediting');

    const currentBalance = userRes.rows[0].balance || '0';
    const newBalance = (BigInt(currentBalance) + BigInt(amountWei)).toString();

    await client.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    await client.query(
      `INSERT INTO transactions (user_id, tx_hash, amount, type, status, currency)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, txHash, amountWei.toString(), 'deposit', 'confirmed', token]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in creditDeposit:', error);
    return false;
  } finally {
    client.release();
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

    // --- Process native coin transactions ---
    for (const tx of block.transactions) {
      try {
        if (!tx.to || tx.value?.isZero()) continue;

        const user = await getUserByAddress(tx.to);
        if (!user) continue;

        await creditDeposit(user.id, tx.value.toString(), tx.hash, 'ETH');
        console.log(`✅ Credited ${ethers.formatEther(tx.value)} ETH to user ${user.id} (tx: ${tx.hash})`);
      } catch (txError) {
        console.error(`Error processing native tx ${tx.hash} in block ${bn}:`, txError);
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
        // Skip logs with empty data
        if (!log.data || log.data === '0x') continue;

        // Extract addresses from topics
        const from = `0x${log.topics[1].slice(26)}`.toLowerCase();
        const to = `0x${log.topics[2].slice(26)}`.toLowerCase();

        // Check if recipient is a user
        const user = await getUserByAddress(to);
        if (!user) continue;

        // Convert raw amount
        const rawAmount = BigInt(log.data);

        // Fetch token decimals
        let decimals = 18;
        try {
          const tokenContract = new ethers.Contract(
            log.address,
            ["function decimals() view returns (uint8)"],
            provider
          );
          decimals = await tokenContract.decimals();
        } catch {
          console.warn(`Could not fetch decimals for token ${log.address}, defaulting to 18`);
        }

        // Convert to human-readable amount
        const humanAmount = Number(rawAmount) / 10 ** decimals;

        await creditDeposit(user.id, rawAmount.toString(), log.transactionHash, log.address);
        console.log(`✅ Credited ${humanAmount} tokens from ${log.address} to user ${user.id} (tx: ${log.transactionHash})`);
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
