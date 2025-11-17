import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const dbConfig = {
  host: '188.245.121.149',
  port: 5999,
  database: 'tov_db',
  user: 'u0t8w',
  password: 'tT20$ur**sqRE--Ppqr',
  ssl: {
    rejectUnauthorized: false // For development only, use proper SSL in production
  }
};

async function runMigrations() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== 'migrations.sql')
      .sort();

    for (const file of migrationFiles) {
      // Check if migration was already executed
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE name = $1',
        [file]
      );

      if (rows.length === 0) {
        console.log(`Running migration: ${file}`);
        
        // Read and execute the migration file
        const migrationSQL = fs.readFileSync(
          path.join(migrationsDir, file), 
          'utf8'
        );
        
        await client.query(migrationSQL);
        
        // Record the migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [file]
        );
        
        console.log(`Migration ${file} completed successfully`);
      } else {
        console.log(`Skipping already executed migration: ${file}`);
      }
    }

    await client.query('COMMIT');
    console.log('All migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(console.error);
