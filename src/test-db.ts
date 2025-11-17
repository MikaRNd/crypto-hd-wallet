// test-db-connection.ts
console.log('1. Script started');

import { Pool } from 'pg';

console.log('2. After import');

const pool = new Pool({
  host: '188.245.121.149',
  port: 5999,
  database: 'tov_db',
  user: 'u0t8w',
  password: 'tT20$ur**sqRE--Ppqr',
  ssl: { rejectUnauthorized: false }
});

console.log('3. Pool created');

console.log(pool)