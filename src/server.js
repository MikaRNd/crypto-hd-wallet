// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { getDepositAddress, pathForUser } = require('./wallet');
const { db } = require('./db');
const database = require('./services/database');
const { providerUrl, hotWalletPk, maxWithdrawWei } = require('./config');

console.log('[DEBUG] server.js loaded'); // 🔹 Debug: server.js is loaded

// -------------------- Ethereum --------------------
const provider = new ethers.JsonRpcProvider(providerUrl);
const hotWallet = new ethers.Wallet(hotWalletPk, provider);

// -------------------- Express --------------------
const app = express();
console.log('[DEBUG] Express app created'); // 🔹 Debug: app initialized

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
  console.log('[DEBUG] ensureMetadataTable called'); // 🔹 Debug: function is invoked
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

    console.log('[DEBUG] Core tables ensured');

    const blockResult = await db.query(
      'SELECT value FROM metadata WHERE key = $1',
      ['last_processed_block']
    );

    if (blockResult.rowCount === 0) {
      await db.query(
        'INSERT INTO metadata (key, value) VALUES ($1, $2)',
        ['last_processed_block', '0']
      );
      console.log('[DEBUG] Inserted default last_processed_block = 0');
    } else {
      console.log('[DEBUG] Metadata row last_processed_block exists');
    }
  } catch (err) {
    console.error('[ERROR] ensureMetadataTable failed:', err);
    throw err;
  }
}

// -------------------- Export --------------------
console.log('[DEBUG] Exporting app and ensureMetadataTable'); // 🔹 Debug: export line reached
module.exports = { app, ensureMetadataTable };
