import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Type definitions for our database tables
type Profile = {
  id: string;
  user_id: string;
  username: string;
  wallet_address: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
};

type Transaction = {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'wager' | 'win' | 'refund';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  blockchain_tx_hash: string | null;
  wallet_address: string | null;
  description: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
};

type ChessGame = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  wager: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  winner_id: string | null;
  game_state: string;
  moves: string;
  player1_time: number;
  player2_time: number;
  current_turn: 'player1' | 'player2';
  last_move_at: string;
  created_at: string;
  updated_at: string;
};

type LudoGame = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  num_players: number;
  status: string;
  current_turn: number;
  wager: number;
  winner_id: string | null;
  game_state: string;
  moves: string;
  last_move_at: string;
  created_at: string;
  updated_at: string;
};

class DatabaseService {
  private dbPath: string;
  private db: Database | null = null;

  constructor() {
    // Use an absolute path for the database file
    this.dbPath = path.join(process.cwd(), 'src', 'db', 'wallet.db');
    
    // Ensure the directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      // Open the SQLite database
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      // Enable foreign key constraints
      await this.db.run('PRAGMA foreign_keys = ON');

      // Read and execute the initialization SQL
      const initSql = fs.readFileSync(path.join(process.cwd(), 'src', 'db', 'init.sql'), 'utf8');
      await this.db.exec(initSql);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  // Profile methods
  async createProfile(userId: string, username: string, walletAddress?: string): Promise<Profile> {
    if (!this.db) throw new Error('Database not initialized');
    
    const profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      username,
      wallet_address: walletAddress || null,
      balance: 0,
    };

    const result = await this.db.run(
      'INSERT INTO profiles (id, user_id, username, wallet_address, balance) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), profile.user_id, profile.username, profile.wallet_address, profile.balance]
    );

    return this.getProfile(userId);
  }

  async getProfile(userId: string): Promise<Profile | null> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get<Profile>('SELECT * FROM profiles WHERE user_id = ?', userId);
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    if (!this.db) throw new Error('Database not initialized');
    
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at')
      .map(([_, value]) => value);
    
    values.push(userId);
    
    await this.db.run(
      `UPDATE profiles SET ${setClause} WHERE user_id = ?`,
      values
    );
    
    return this.getProfile(userId);
  }

  // Transaction methods
  async createTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: Transaction['status'] }): Promise<Transaction> {
    if (!this.db) throw new Error('Database not initialized');
    
    const newTransaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'> = {
      ...transaction,
      status: transaction.status || 'pending',
      metadata: typeof transaction.metadata === 'string' ? transaction.metadata : JSON.stringify(transaction.metadata || {}),
    };

    const result = await this.db.run(
      `INSERT INTO transactions (
        id, user_id, type, amount, status, blockchain_tx_hash, 
        wallet_address, description, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        newTransaction.user_id,
        newTransaction.type,
        newTransaction.amount,
        newTransaction.status,
        newTransaction.blockchain_tx_hash || null,
        newTransaction.wallet_address || null,
        newTransaction.description || null,
        newTransaction.metadata
      ]
    );

    return this.getTransaction(result.lastID!.toString());
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get<Transaction>('SELECT * FROM transactions WHERE id = ?', transactionId);
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.all<Transaction>('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC', userId);
  }

  // Chess game methods
  async createChessGame(game: Omit<ChessGame, 'id' | 'created_at' | 'updated_at' | 'status' | 'moves' | 'game_state' | 'player1_time' | 'player2_time' | 'current_turn' | 'last_move_at'>): Promise<ChessGame> {
    if (!this.db) throw new Error('Database not initialized');
    
    const newGame: Omit<ChessGame, 'id' | 'created_at' | 'updated_at'> = {
      ...game,
      status: 'waiting',
      game_state: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: '[]',
      player1_time: 600000, // 10 minutes in milliseconds
      player2_time: 600000,
      current_turn: 'player1',
      last_move_at: new Date().toISOString(),
    };

    const result = await this.db.run(
      `INSERT INTO chess_games (
        id, player1_id, player2_id, wager, status, winner_id, game_state, moves,
        player1_time, player2_time, current_turn, last_move_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        newGame.player1_id,
        newGame.player2_id || null,
        newGame.wager,
        newGame.status,
        newGame.winner_id || null,
        newGame.game_state,
        newGame.moves,
        newGame.player1_time,
        newGame.player2_time,
        newGame.current_turn,
        newGame.last_move_at
      ]
    );

    return this.getChessGame(result.lastID!.toString());
  }

  async getChessGame(gameId: string): Promise<ChessGame | null> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get<ChessGame>('SELECT * FROM chess_games WHERE id = ?', gameId);
  }

  async updateChessGame(gameId: string, updates: Partial<ChessGame>): Promise<ChessGame> {
    if (!this.db) throw new Error('Database not initialized');
    
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(([_, value]) => value);
    
    values.push(gameId);
    
    await this.db.run(
      `UPDATE chess_games SET ${setClause} WHERE id = ?`,
      values
    );
    
    return this.getChessGame(gameId);
  }

  // Ludo game methods
  async createLudoGame(game: Omit<LudoGame, 'id' | 'created_at' | 'updated_at' | 'status' | 'moves' | 'game_state' | 'last_move_at' | 'current_turn'>): Promise<LudoGame> {
    if (!this.db) throw new Error('Database not initialized');
    
    const newGame: Omit<LudoGame, 'id' | 'created_at' | 'updated_at'> = {
      ...game,
      status: 'waiting',
      current_turn: 1,
      game_state: JSON.stringify({
        player1: { tokens: [0, 0, 0, 0], color: 'red' },
        player2: { tokens: [0, 0, 0, 0], color: 'yellow' },
        player3: { tokens: [0, 0, 0, 0], color: 'green' },
        player4: { tokens: [0, 0, 0, 0], color: 'blue' },
        lastRoll: null
      }),
      moves: '[]',
      last_move_at: new Date().toISOString(),
    };

    const result = await this.db.run(
      `INSERT INTO ludo_games (
        id, player1_id, player2_id, player3_id, player4_id, num_players, status, 
        current_turn, wager, winner_id, game_state, moves, last_move_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        newGame.player1_id,
        newGame.player2_id || null,
        newGame.player3_id || null,
        newGame.player4_id || null,
        newGame.num_players,
        newGame.status,
        newGame.current_turn,
        newGame.wager,
        newGame.winner_id || null,
        newGame.game_state,
        newGame.moves,
        newGame.last_move_at
      ]
    );

    return this.getLudoGame(result.lastID!.toString());
  }

  async getLudoGame(gameId: string): Promise<LudoGame | null> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get<LudoGame>('SELECT * FROM ludo_games WHERE id = ?', gameId);
  }

  async updateLudoGame(gameId: string, updates: Partial<LudoGame>): Promise<LudoGame> {
    if (!this.db) throw new Error('Database not initialized');
    
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(([_, value]) => value);
    
    values.push(gameId);
    
    await this.db.run(
      `UPDATE ludo_games SET ${setClause} WHERE id = ?`,
      values
    );
    
    return this.getLudoGame(gameId);
  }

  // Balance management methods
  async incrementBalance(userId: string, amount: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'UPDATE profiles SET balance = balance + ? WHERE user_id = ?',
      [amount, userId]
    );
  }

  async decrementBalance(userId: string, amount: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      await this.db.run('BEGIN TRANSACTION');
      
      // Check if the user has sufficient balance
      const profile = await this.getProfile(userId);
      if (!profile || profile.balance < amount) {
        await this.db.run('ROLLBACK');
        return false;
      }
      
      // Proceed with the decrement
      await this.db.run(
        'UPDATE profiles SET balance = balance - ? WHERE user_id = ?',
        [amount, userId]
      );
      
      await this.db.run('COMMIT');
      return true;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  // Close the database connection
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

// Create a singleton instance
export const dbService = new DatabaseService();

// Initialize the database when this module is imported
(async () => {
  try {
    await dbService.initialize();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
})();
