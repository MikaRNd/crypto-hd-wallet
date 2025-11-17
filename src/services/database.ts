import { db } from '@/config/database';

export interface DepositAddress {
  id: string;
  user_id: string;
  wallet_address: string;
  created_at: Date;
}

export interface User {
  id: string;
  username: string;
  created_at: Date;
  deposit_address?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  tx_hash: string;
  status: string;
  created_at: Date;
}

export const database = {
  // User operations
  async createUser(username: string): Promise<User> {
    const query = `
      INSERT INTO users (username)
      VALUES ($1)
      RETURNING *
    `;
    const result = await db.query(query, [username]);
    return result.rows[0];
  },

  // Deposit address operations
  async createDepositAddress(userId: string, walletAddress: string): Promise<DepositAddress> {
    const query = `
      INSERT INTO deposit_addresses (user_id, wallet_address)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [userId, walletAddress.toLowerCase()]);
    return result.rows[0];
  },

  // Transaction operations
  async createTransaction(transactionData: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    const { user_id, amount, currency, tx_hash, status } = transactionData;
    const query = `
      INSERT INTO transactions (user_id, amount, currency, tx_hash, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(query, [user_id, amount, currency, tx_hash, status]);
    return result.rows[0];
  },

  // Query operations
  async getUserById(userId: string): Promise<User | null> {
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
    
    return {
      ...user,
      deposit_address: addressResult.rows[0]?.wallet_address
    };
  },

  async getDepositAddressesByUserId(userId: string): Promise<DepositAddress[]> {
    const query = `
      SELECT * FROM deposit_addresses 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  },

  async getDepositAddressByAddress(walletAddress: string): Promise<DepositAddress | null> {
    const query = `
      SELECT * FROM deposit_addresses 
      WHERE wallet_address = $1
    `;
    const result = await db.query(query, [walletAddress.toLowerCase()]);
    return result.rows[0] || null;
  },

  async getDepositAddressById(id: string): Promise<DepositAddress | null> {
    const query = `
      SELECT * FROM deposit_addresses 
      WHERE id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  },

  async updateDepositAddress(
    id: string, 
    updates: Partial<Omit<DepositAddress, 'id' | 'created_at'>>
  ): Promise<DepositAddress> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const query = `
      UPDATE deposit_addresses
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;
    
    const result = await db.query(query, [...values, id]);
    return result.rows[0];
  },

  async deleteDepositAddress(id: string): Promise<void> {
    const query = `
      DELETE FROM deposit_addresses
      WHERE id = $1
    `;
    await db.query(query, [id]);
  },

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    const query = `
      SELECT * FROM transactions 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }
};

export default database;
