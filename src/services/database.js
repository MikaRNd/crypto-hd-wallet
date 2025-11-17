// src/services/database.js
const { db } = require('../db');

const database = {
  // -------------------- Users --------------------
  async createUser(username) {
    const query = `
      INSERT INTO users (username)
      VALUES ($1)
      RETURNING *
    `;
    const result = await db.query(query, [username]);
    return result.rows[0];
  },

  // -------------------- Deposit Addresses --------------------
  async createDepositAddress(userId, walletAddress) {
    const query = `
      INSERT INTO deposit_addresses (user_id, wallet_address)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [userId, walletAddress.toLowerCase()]);
    return result.rows[0];
  },

  async getDepositAddressesByUserId(userId) {
    const query = `
      SELECT * FROM deposit_addresses
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  },

  // -------------------- Transactions --------------------
  async createTransaction({ user_id, amount, currency = 'ETH', tx_hash = null, type = 'deposit', status = 'pending' }) {
    const query = `
      INSERT INTO transactions (user_id, amount, currency, tx_hash, type, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(query, [user_id, amount.toString(), currency, tx_hash, type, status]);
    return result.rows[0];
  },

  async getTransactionsByUserId(userId) {
    const query = `
      SELECT * FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  },

  async getTransactionsByCurrency(userId, currency) {
    const query = `
      SELECT * FROM transactions
      WHERE user_id = $1 AND currency = $2
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId, currency]);
    return result.rows;
  },

  // -------------------- Users --------------------
  async getUserById(userId) {
    const userQuery = `
      SELECT * FROM users
      WHERE id = $1
    `;
    const userResult = await db.query(userQuery, [userId]);
    if (userResult.rows.length === 0) return null;

    const user = userResult.rows[0];

    const addressQuery = `
      SELECT wallet_address
      FROM deposit_addresses
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const addressResult = await db.query(addressQuery, [userId]);

    // Fetch aggregated token balances
    const tokenQuery = `
      SELECT currency, SUM(amount) AS amount
      FROM transactions
      WHERE user_id = $1
      GROUP BY currency
    `;
    const tokenResult = await db.query(tokenQuery, [userId]);
    const tokens = {};
    tokenResult.rows.forEach(r => {
      tokens[r.currency] = r.amount;
    });

    return {
      ...user,
      deposit_address: addressResult.rows[0]?.wallet_address,
      tokens
    };
  },

  // -------------------- Token-specific Helpers --------------------
  async creditToken(userId, amount, currency, txHash) {
    // amount: string or BigInt
    return this.createTransaction({
      user_id: userId,
      amount,
      currency,
      tx_hash: txHash,
      type: 'deposit',
      status: 'confirmed'
    });
  },

  async debitToken(userId, amount, currency, txHash) {
    return this.createTransaction({
      user_id: userId,
      amount,
      currency,
      tx_hash: txHash,
      type: 'withdrawal',
      status: 'pending'
    });
  },

  // -------------------- Utility --------------------
  async getTokenBalance(userId, currency) {
    const query = `
      SELECT SUM(amount) as balance
      FROM transactions
      WHERE user_id = $1 AND currency = $2
    `;
    const result = await db.query(query, [userId, currency]);
    return result.rows[0]?.balance || '0';
  }
};

module.exports = database;
