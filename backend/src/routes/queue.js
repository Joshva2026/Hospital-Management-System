// OPD token queue (staff side). Login required.
const express = require('express');
const { query, pool } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

async function todayIST() {
  return (await query("SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date::text AS d")).rows[0].d;
}

// GET /api/queue?date=YYYY-MM-DD
router.get('/', asyncHandler(async (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : await todayIST();
  const tokens = await query(
    `SELECT t.token_id, t.doctor_id, d.doctor_name, t.token_no, t.status, t.patient_id, t.created_at, t.called_at
     FROM opd_tokens t JOIN doctors d ON d.doctor_id = t.doctor_id
     WHERE t.token_date = $1
     ORDER BY d.doctor_name, t.token_no`,
    [date]
  );
  const doctors = await query("SELECT doctor_id, doctor_name FROM doctors WHERE status = 'ACTIVE' ORDER BY doctor_name");
  res.json({ success: true, date, doctors: doctors.rows, data: tokens.rows });
}));

// POST /api/queue/tokens  { doctorId, patientId?, date? }  - issue the next token
router.post('/tokens', asyncHandler(async (req, res) => {
  const doctorId = String((req.body && req.body.doctorId) || '').trim();
  const patientId = req.body && req.body.patientId ? String(req.body.patientId).trim() : null;
  if (!doctorId) throw new AppError('Select a doctor.', 422);
  const date = isDate(req.body && req.body.date) ? req.body.date : await todayIST();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the doctor row so two staff members can't get the same token number.
    const doc = await client.query("SELECT doctor_id FROM doctors WHERE doctor_id = $1 AND status = 'ACTIVE' FOR UPDATE", [doctorId]);
    if (!doc.rows.length) throw new AppError('Doctor not found or inactive.', 404);
    const next = await client.query(
      'SELECT COALESCE(MAX(token_no), 0) + 1 AS n FROM opd_tokens WHERE doctor_id = $1 AND token_date = $2',
      [doctorId, date]
    );
    const ins = await client.query(
      'INSERT INTO opd_tokens (doctor_id, token_date, token_no, patient_id) VALUES ($1, $2, $3, $4) RETURNING token_id, doctor_id, token_date::text AS token_date, token_no, patient_id, status, created_at, called_at',
      [doctorId, date, next.rows[0].n, patientId]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/queue/call-next  { doctorId, date? }  - finish the current token, call the next waiting one
router.post('/call-next', asyncHandler(async (req, res) => {
  const doctorId = String((req.body && req.body.doctorId) || '').trim();
  if (!doctorId) throw new AppError('Select a doctor.', 422);
  const date = isDate(req.body && req.body.date) ? req.body.date : await todayIST();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT doctor_id FROM doctors WHERE doctor_id = $1 FOR UPDATE', [doctorId]);
    await client.query(
      "UPDATE opd_tokens SET status = 'DONE' WHERE doctor_id = $1 AND token_date = $2 AND status = 'CALLED'",
      [doctorId, date]
    );
    const next = await client.query(
      `UPDATE opd_tokens SET status = 'CALLED', called_at = NOW()
       WHERE token_id = (
         SELECT token_id FROM opd_tokens
         WHERE doctor_id = $1 AND token_date = $2 AND status = 'WAITING'
         ORDER BY token_no LIMIT 1)
       RETURNING token_id, doctor_id, token_date::text AS token_date, token_no, patient_id, status, created_at, called_at`,
      [doctorId, date]
    );
    await client.query('COMMIT');
    if (!next.rows.length) return res.json({ success: true, data: null, message: 'No patients are waiting.' });
    res.json({ success: true, data: next.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/queue/tokens/:id/done
router.post('/tokens/:id/done', asyncHandler(async (req, res) => {
  const { rows } = await query(
    "UPDATE opd_tokens SET status = 'DONE' WHERE token_id = $1 RETURNING token_id, doctor_id, token_date::text AS token_date, token_no, patient_id, status, created_at, called_at",
    [req.params.id]
  );
  if (!rows.length) throw new AppError('Token not found.', 404);
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
