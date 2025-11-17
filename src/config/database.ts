import { Pool, PoolConfig } from 'pg';

const dbConfig: PoolConfig = {
  host: '188.245.121.149',
  port: 5999,
  database: 'tov_db',
  user: 'u0t8w',
  password: 'tT20$ur**sqRE--Ppqr',
  ssl: {
    rejectUnauthorized: false // For development only, use proper SSL in production
  }
};

class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool(dbConfig);
    
    // Test the connection
    this.pool.query('SELECT NOW()', (err) => {
      if (err) {
        console.error('Error connecting to the database:', err);
      } else {
        console.log('Successfully connected to PostgreSQL database');
      }
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', { text, error });
      throw error;
    }
  }

  public async close() {
    await this.pool.end();
  }
}

export const db = Database.getInstance();
