// ============================================================================
// Centralized ID generation.
//
// CRITICAL DESIGN NOTE:
// IDs are NEVER computed as "count rows + 1" (that breaks the moment a row
// is deleted or two requests race). Instead every ID type has a real
// PostgreSQL SEQUENCE (see migrations/001_init.sql). Sequences are:
//   - Atomic under concurrency (two simultaneous requests never get the same
//     value - PostgreSQL guarantees this at the storage engine level).
//   - Persistent - survive server/app restarts because they live in the DB,
//     not in application memory.
//   - Gap-tolerant - safe even if a transaction that consumed a value later
//     rolls back (an ID may be "skipped" but is NEVER duplicated).
//
// The Excel seed data used IDs like PAT-2026-000001 .. PAT-2026-000100.
// The seed script advances each sequence to MAX(imported number) so that the
// very next generated id continues from 000101, exactly as required.
// ============================================================================

const { query } = require('../config/db');

const PATTERNS = {
  patient: { seq: 'patient_id_seq', prefix: () => `PAT-${new Date().getFullYear()}-`, pad: 6 },
  visit: { seq: 'visit_id_seq', prefix: () => 'VIS-', pad: 5 },
  admission: { seq: 'admission_id_seq', prefix: () => 'ADM-', pad: 5 },
  report: { seq: 'report_id_seq', prefix: () => 'RPT-', pad: 6 },
  discharge: { seq: 'discharge_id_seq', prefix: () => 'DIS-', pad: 5 },
  appointment: { seq: 'appointment_id_seq', prefix: () => 'APT-', pad: 5 },
  doctor: { seq: 'doctor_id_seq', prefix: () => 'DOC-', pad: 4 },
  log: { seq: 'log_id_seq', prefix: () => 'LOG-', pad: 5 },
};

/**
 * Generate the next ID for a given entity type.
 * Optionally pass a `client` (from withTransaction) so the nextval() call
 * participates in the same transaction as the INSERT that uses it.
 */
async function nextId(type, client = null) {
  const cfg = PATTERNS[type];
  if (!cfg) throw new Error(`Unknown ID type: ${type}`);

  const runner = client ? client.query.bind(client) : query;
  const { rows } = await runner(`SELECT nextval('${cfg.seq}') AS val`);
  const num = String(rows[0].val).padStart(cfg.pad, '0');
  return `${cfg.prefix()}${num}`;
}

module.exports = { nextId };
