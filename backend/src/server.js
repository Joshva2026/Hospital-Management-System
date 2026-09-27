const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await pool.query('SELECT 1'); // fail fast if DB is unreachable
    console.log('Connected to PostgreSQL successfully.');
  } catch (err) {
    console.error('FATAL: Could not connect to PostgreSQL.', err.message);
    console.error('Check your .env PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD values and that Postgres is running.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`HMS backend listening on http://localhost:${PORT}`);
  });
}

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
