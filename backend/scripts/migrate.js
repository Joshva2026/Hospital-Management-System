// Runs all .sql files in migrations/ against the configured PostgreSQL database in filename order.
// Idempotent: scripts use CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING
// so running multiple times is safe.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s)...`);
  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`Running migration: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await pool.query(sql);
      console.log(`✅ Applied: ${file}`);
    }
    console.log('✅ All migrations applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
