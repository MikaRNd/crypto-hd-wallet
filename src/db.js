const { Pool } = require('pg');

// Use a connection string identical to the working psql URL, with optional override
const defaultConnectionString =
  'postgresql://u0t8w:tT20**sqRE--Ppqr@188.245.121.149:5999/tov_db';

const connectionString = process.env.PG_CONNECTION_STRING || defaultConnectionString;

// Initialize PostgreSQL pool
const pool = new Pool({ connectionString });

async function initDb() {
  console.log('Initializing PostgreSQL connection...');
  try {
    await pool.query('SELECT NOW()');
    console.log('Successfully connected to PostgreSQL');
    return pool;
  } catch (error) {
    console.error('Failed to initialize PostgreSQL connection:', error.message || error);
    throw error;
  }
}

// Metadata helpers using the metadata table
async function getMeta(key) {
  try {
    const result = await pool.query(
      'SELECT value FROM metadata WHERE key = $1',
      [key]
    );
    return result.rows[0]?.value || null;
  } catch (error) {
    console.error('Error in getMeta:', error);
    return null;
  }
}

async function setMeta(key, value) {
  try {
    await pool.query(
      `INSERT INTO metadata (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
    return true;
  } catch (error) {
    console.error('Error in setMeta:', error);
    return false;
  }
}

// No-op for PostgreSQL (kept for API compatibility)
function saveDb() {
  return Promise.resolve();
}

module.exports = {
  initDb,
  db: pool,
  getMeta,
  setMeta,
  saveDb,
};
