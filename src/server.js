// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { getDepositAddress, pathForUser } = require('./wallet');
const { db } = require('./db');
const database = require('./services/database');
const { providerUrl, hotWalletPk, maxWithdrawWei } = require('./config');

// -------------------- Ethereum --------------------
const provider = new ethers.JsonRpcProvider(providerUrl);
const hotWallet = new ethers.Wallet(hotWalletPk, provider);

// -------------------- Express --------------------
const app = express();
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) return callback(new Error('CORS origin denied'), false);
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// -------------------- Schema & metadata setup --------------------
async function ensureMetadataTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        balance NUMERIC(36, 18) NOT NULL DEFAULT 0,
        derivation_path VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS deposit_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_address VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(36, 18) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'ETH',
        tx_hash VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS metadata (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS user_mappings (
        external_id VARCHAR(255) PRIMARY KEY,
        internal_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('Core tables ensured');

    const blockResult = await db.query(
      'SELECT value FROM metadata WHERE key = $1',
      ['last_processed_block']
    );

    if (blockResult.rowCount === 0) {
      await db.query(
        'INSERT INTO metadata (key, value) VALUES ($1, $2)',
        ['last_processed_block', '0']
      );
      console.log('Inserted default last_processed_block = 0');
    } else {
      console.log('Metadata row last_processed_block exists');
    }
  } catch (err) {
    console.error('Error in ensureMetadataTable:', err);
    throw err;
  }
}

// -------------------- User helpers --------------------
async function getUser(id) {
  try {
    const user = await database.getUserById(id);
    if (!user) return null;

    const balanceResult = await db.query(
      'SELECT balance FROM users WHERE id = $1',
      [id]
    );
    const balance = balanceResult.rows[0]?.balance || '0';

    return {
      id: user.id,
      username: user.username,
      balance: balance,
      deposit_address: user.deposit_address,
      derivation_path: user.derivation_path || null
    };
  } catch (error) {
    console.error('Error in getUser:', error);
    return null;
  }
}

async function findMapping(externalId) {
  try {
    const result = await db.query(
      'SELECT internal_id FROM user_mappings WHERE external_id = $1',
      [externalId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in findMapping:', error);
    return null;
  }
}

async function createMapping(externalId, internalId) {
  try {
    await db.query(
      `INSERT INTO user_mappings (external_id, internal_id, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (external_id) 
       DO UPDATE SET internal_id = $2, updated_at = NOW()`,
      [externalId, internalId]
    );
    return true;
  } catch (error) {
    console.error('Error in createMapping:', error);
    return false;
  }
}

// -------------------- Routes --------------------

// Create new user
app.post('/users', async (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });

  try {
    const user = await database.createUser(username);
    const address = getDepositAddress(user.id);
    const path = pathForUser(user.id);

    await database.createDepositAddress(user.id, address.toLowerCase());
    await db.query(
      'UPDATE users SET derivation_path = $1 WHERE id = $2',
      [path, user.id]
    );

    res.json({
      id: user.id,
      username,
      deposit_address: address,
      derivation_path: path,
      balance: user.balance || '0',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user', details: e.message });
  }
});

// Deposit endpoint
app.post('/deposit', async (req, res) => {
  const { userId: externalUserId } = req.body || {};
  if (!externalUserId) return res.status(400).json({ error: 'userId required' });

  try {
    let mapping = await findMapping(externalUserId);
    let user;
    if (mapping?.internal_id) {
      user = await getUser(mapping.internal_id);
      if (!user) return res.status(500).json({ error: 'user data corrupted' });
    } else {
      const username = `user_${externalUserId}_${Date.now()}`;
      const newUser = await database.createUser(username);
      const internalId = newUser.id;
      const address = getDepositAddress(internalId);
      const path = pathForUser(internalId);
      await database.createDepositAddress(internalId, address.toLowerCase());
      await db.query('UPDATE users SET derivation_path = $1 WHERE id = $2', [path, internalId]);
      await createMapping(externalUserId, internalId);
      user = await getUser(internalId);
    }

    res.json({ userId: user.id, deposit_address: user.deposit_address });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to create/get deposit address' });
  }
});

// Get user balance
app.get('/balance', async (req, res) => {
  const userIdParam = req.query.userId;
  if (!userIdParam) return res.status(400).json({ error: 'userId required' });

  const userId = Number(userIdParam);
  if (Number.isNaN(userId)) return res.status(400).json({ error: 'invalid userId' });

  try {
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: 'user not found' });

    const balanceStr = user.balance || '0';
    let balanceWei;
    try {
      balanceWei = ethers.parseEther(balanceStr); // BigInt in wei
    } catch {
      balanceWei = BigInt(balanceStr); // fallback
    }

    const balanceEth = ethers.formatEther(balanceWei);

    res.json({ userId: user.id, balanceWei: balanceWei.toString(), balanceEth });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Get transactions
app.get('/transactions', async (req, res) => {
  const userIdParam = req.query.userId;
  if (!userIdParam) return res.status(400).json({ error: 'userId required' });
  const userId = Number(userIdParam);
  if (Number.isNaN(userId)) return res.status(400).json({ error: 'invalid userId' });

  try {
    const txs = await database.getTransactionsByUserId(userId);
    res.json(txs.map(r => ({ ...r, amountEth: ethers.formatEther(r.amount.toString()) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Withdraw
app.post('/withdraw', async (req, res) => {
  try {
    const { userId, to, amountEth } = req.body;
    if (!userId || !to || !amountEth) return res.status(400).json({ error: 'userId, to, amountEth required' });

    const user = await getUser(Number(userId));
    if (!user) return res.status(404).json({ error: 'user not found' });

    let amountWei;
    try {
      amountWei = ethers.parseEther(String(amountEth));
    } catch (err) {
      return res.status(400).json({ error: 'invalid amount' });
    }

    if (maxWithdrawWei && amountWei > maxWithdrawWei) return res.status(400).json({ error: 'amount exceeds max' });

    let toAddress;
    try { toAddress = ethers.getAddress(to); } catch { return res.status(400).json({ error: 'invalid destination address' }); }

    // parse user balance safely
    let userBal;
    try { userBal = ethers.parseEther(user.balance || '0'); } catch { userBal = BigInt(user.balance || '0'); }

    if (userBal < amountWei) return res.status(400).json({ error: 'insufficient balance' });

    // update balance in DB
    const newBal = (userBal - amountWei).toString();
    await db.query('UPDATE users SET balance = $1 WHERE id = $2', [newBal, user.id]);

    // create transaction
    const txInsert = await db.query(
      `INSERT INTO transactions (user_id, amount, type, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.id, amountWei.toString(), 'withdrawal', 'pending']
    );
    const txRecord = txInsert.rows[0];

    // send tx from hot wallet
    const tx = await hotWallet.sendTransaction({ to: toAddress, value: amountWei });
    await db.query('UPDATE transactions SET tx_hash = $1 WHERE id = $2', [tx.hash, txRecord.id]);

    const receipt = await tx.wait();
    const status = receipt.status === 1 ? 'confirmed' : 'failed';
    await db.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, txRecord.id]);

    if (status === 'failed') {
      await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amountWei.toString(), user.id]);
    }

    res.json({ txHash: tx.hash });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'withdrawal failed' });
  }
});

// -------------------- Startup --------------------
module.exports = { app, ensureMetadataTable };
