// DEMO billing module. Sample data only. No payment gateway, no real bills.
const express = require('express');
const { query, pool } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

const DEMO_NOTE = 'DEMO ONLY - sample billing. Not a real bill. No payment is taken.';

// GET /api/billing - list demo invoices
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.invoice_id, i.patient_id, i.visit_id, i.total, i.status, i.created_at, p.full_name AS patient_name
     FROM invoices i
     LEFT JOIN patients p ON p.patient_id = i.patient_id
     ORDER BY i.created_at DESC
     LIMIT 200`
  );
  res.json({ success: true, data: rows, note: DEMO_NOTE });
}));

// GET /api/billing/:id - one demo invoice with items
router.get('/:id', asyncHandler(async (req, res) => {
  const inv = await query(
    `SELECT i.*, p.full_name AS patient_name
     FROM invoices i LEFT JOIN patients p ON p.patient_id = i.patient_id
     WHERE i.invoice_id = $1`,
    [req.params.id]
  );
  if (!inv.rows.length) throw new AppError('Invoice not found.', 404);
  const items = await query(
    'SELECT description, qty, rate, amount FROM invoice_items WHERE invoice_id = $1 ORDER BY item_id',
    [req.params.id]
  );
  res.json({ success: true, data: { ...inv.rows[0], items: items.rows }, note: DEMO_NOTE });
}));

// POST /api/billing/demo  { visitId }  - create a DEMO invoice from a visit
router.post('/demo', asyncHandler(async (req, res) => {
  const visitId = String((req.body && req.body.visitId) || '').trim();
  if (!visitId) throw new AppError('Visit ID is required.', 422);

  const v = await query(
    `SELECT v.visit_id, v.patient_id, d.doctor_name, d.consultation_fee
     FROM patient_visits v
     JOIN doctors d ON d.doctor_id = v.doctor_id
     WHERE v.visit_id = $1`,
    [visitId]
  );
  if (!v.rows.length) throw new AppError('Visit not found.', 404);
  const visit = v.rows[0];

  const items = [
    { description: `Consultation - ${visit.doctor_name} (demo)`, qty: 1, rate: Number(visit.consultation_fee) || 0 },
    { description: 'Registration charge (demo)', qty: 1, rate: 50 },
  ];
  const total = items.reduce((sum, it) => sum + it.qty * it.rate, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seq = await client.query(
      "SELECT 'INV-' || LPAD(nextval('invoice_id_seq')::text, 6, '0') AS id"
    );
    const invoiceId = seq.rows[0].id;
    await client.query(
      `INSERT INTO invoices (invoice_id, patient_id, visit_id, total, status, note)
       VALUES ($1, $2, $3, $4, 'DEMO', $5)`,
      [invoiceId, visit.patient_id, visit.visit_id, total, DEMO_NOTE]
    );
    for (const it of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, qty, rate, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoiceId, it.description, it.qty, it.rate, it.qty * it.rate]
      );
    }
    await writeAudit(client, {
      adminId: req.admin.adminId,
      action: 'DEMO_INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: invoiceId,
      description: `Demo invoice ${invoiceId} created for visit ${visit.visit_id}`,
    });
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { invoice_id: invoiceId, total }, note: DEMO_NOTE });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
