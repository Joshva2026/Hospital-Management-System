// ============================================================================
// PostgreSQL connection pool
// ============================================================================
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Unexpected error on idle client - log but don't crash the whole app.
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Run a query using the shared pool.
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a set of operations inside a single transaction.
 * `fn` receives a connected client; you must use `client.query(...)` inside it.
 * Automatically COMMITs on success and ROLLBACKs on any thrown error.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
