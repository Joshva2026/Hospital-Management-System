const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, withTransaction } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

// GET /api/beds?wardId=&status=
router.get('/', asyncHandler(async (req, res) => {
  const { wardId = '', status = '' } = req.query;
  const conditions = [];
  const params = [];
  if (wardId) { params.push(wardId); conditions.push(`b.ward_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT b.*, w.ward_name, p.full_name AS current_patient_name
     FROM beds b
     JOIN wards w ON w.ward_id = b.ward_id
     LEFT JOIN patients p ON p.patient_id = b.current_patient_id
     ${where} ORDER BY w.ward_name, b.bed_number`,
    params
  );
  res.json({ success: true, data: rows });
}));

// GET /api/beds/available?wardId=  -> used by admission form's bed dropdown
router.get('/available', asyncHandler(async (req, res) => {
  const { wardId } = req.query;
  if (!wardId) throw new AppError('wardId is required.', 422);
  const { rows } = await query(
    `SELECT * FROM beds WHERE ward_id = $1 AND status = 'AVAILABLE' ORDER BY bed_number`,
    [wardId]
  );
  res.json({ success: true, data: rows });
}));

async function nextBedId() {
  const { rows } = await query("SELECT nextval('beds_seq') AS seq");
  return 'BED-' + String(rows[0].seq).padStart(5, '0');
}

router.post(
  '/',
  [
    body('wardId').notEmpty().withMessage('Ward is required.'),
    body('bedNumber').trim().notEmpty().withMessage('Bed number is required.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);
    const { wardId, bedNumber, bedType } = req.body;

    await withTransaction(async (client) => {
      const bedId = await nextBedId();
      const { rows } = await client.query(
        `INSERT INTO beds (bed_id, ward_id, bed_number, bed_type, status) VALUES ($1,$2,$3,$4,'AVAILABLE') RETURNING *`,
        [bedId, wardId, bedNumber, bedType || 'General']
      );
      await client.query(`UPDATE wards SET total_beds = total_beds + 1, updated_at = NOW() WHERE ward_id = $1`, [wardId]);
      await writeAudit(client, { adminId: req.admin.adminId, action: 'CREATE', entityType: 'BED', entityId: bedId, description: `Added bed ${bedNumber} to ward ${wardId}.` });
      res.status(201).json({ success: true, data: rows[0] });
    });
  })
);

// PATCH /api/beds/:id/status  -> e.g. put a bed into MAINTENANCE
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['AVAILABLE', 'MAINTENANCE'].includes(status)) {
      throw new AppError('Status can only be manually set to AVAILABLE or MAINTENANCE. Use the admission/discharge flow for OCCUPIED beds.', 422);
    }
    const { rows: current } = await query('SELECT * FROM beds WHERE bed_id = $1', [req.params.id]);
    if (!current[0]) throw new AppError('Bed not found.', 404);
    if (current[0].status === 'OCCUPIED') throw new AppError('Cannot change status of an occupied bed. Discharge the patient first.', 409);

    const { rows } = await query(
      `UPDATE beds SET status=$1, last_updated=NOW() WHERE bed_id=$2 RETURNING *`,
      [status, req.params.id]
    );
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'BED', entityId: req.params.id, description: `Bed ${req.params.id} set to ${status}.` });
    res.json({ success: true, data: rows[0] });
  })
);

// PUT /api/beds/:id -> Edit bed
router.put(
  '/:id',
  [
    body('bedNumber').trim().notEmpty().withMessage('Bed number is required.'),
    body('wardId').notEmpty().withMessage('Ward is required.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { id } = req.params;
    const { bedNumber, bedType, wardId, status } = req.body;

    const { rows: current } = await query('SELECT * FROM beds WHERE bed_id = $1', [id]);
    if (!current[0]) throw new AppError('Bed not found.', 404);

    const isOccupied = current[0].status === 'OCCUPIED';

    if (isOccupied && current[0].ward_id !== wardId) {
      throw new AppError('Cannot move an occupied bed to a different ward.', 409);
    }

    if (status && status !== current[0].status) {
      if (isOccupied && status === 'AVAILABLE') {
        throw new AppError('Cannot change an occupied bed to AVAILABLE. You must discharge the patient first.', 409);
      }
      if (isOccupied && status === 'MAINTENANCE') {
        throw new AppError('Cannot change an occupied bed to MAINTENANCE. You must discharge or move the patient first.', 409);
      }
      if (!isOccupied && status === 'OCCUPIED') {
        throw new AppError('Cannot manually change bed status to OCCUPIED. You must admit a patient.', 409);
      }
    }

    const { rows: dupCheck } = await query(
      'SELECT * FROM beds WHERE ward_id = $1 AND bed_number = $2 AND bed_id != $3',
      [wardId, bedNumber, id]
    );
    if (dupCheck.length > 0) throw new AppError('A bed with this number already exists in this ward.', 409);

    const newStatus = status || current[0].status;

    await withTransaction(async (client) => {
      if (current[0].ward_id !== wardId) {
        await client.query(`UPDATE wards SET total_beds = total_beds - 1 WHERE ward_id = $1`, [current[0].ward_id]);
        await client.query(`UPDATE wards SET total_beds = total_beds + 1 WHERE ward_id = $1`, [wardId]);
      }

      const { rows } = await client.query(
        `UPDATE beds SET bed_number=$1, bed_type=$2, ward_id=$3, status=$4, last_updated=NOW() WHERE bed_id=$5 RETURNING *`,
        [bedNumber, bedType || 'General', wardId, newStatus, id]
      );
      await writeAudit(client, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'BED', entityId: id, description: `Updated bed ${id}.` });
      res.json({ success: true, data: rows[0] });
    });
  })
);

module.exports = router;
