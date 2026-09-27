const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { nextId } = require('../utils/idGenerator');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { patientId = '', doctorId = '', date = '', status = '', page = 1, limit = 10 } = req.query;
  const conditions = [];
  const params = [];
  if (patientId) { params.push(patientId); conditions.push(`v.patient_id = $${params.length}`); }
  if (doctorId) { params.push(doctorId); conditions.push(`v.doctor_id = $${params.length}`); }
  if (date) { params.push(date); conditions.push(`v.visit_date = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`v.status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM patient_visits v ${where}`, params);
  params.push(limitNum, offset);
  const { rows } = await query(
    `SELECT v.*, p.full_name AS patient_name, d.doctor_name, s.speciality_name
     FROM patient_visits v
     JOIN patients p ON p.patient_id = v.patient_id
     JOIN doctors d ON d.doctor_id = v.doctor_id
     JOIN specialities s ON s.speciality_id = v.speciality_id
     ${where} ORDER BY v.visit_date DESC, v.visit_time DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, data: rows, pagination: { page: pageNum, limit: limitNum, total: countRes.rows[0].total, totalPages: Math.ceil(countRes.rows[0].total / limitNum) } });
}));

const visitValidators = [
  body('patientId').notEmpty().withMessage('Patient is required.'),
  body('doctorId').notEmpty().withMessage('Doctor is required.'),
  body('specialityId').notEmpty().withMessage('Speciality is required.'),
  body('visitDate').isISO8601().withMessage('Valid visit date is required.'),
  body('visitTime').notEmpty().withMessage('Visit time is required.'),
  body('visitType').isIn(['OPD', 'EMERGENCY', 'FOLLOW_UP']).withMessage('Invalid visit type.'),
  body('complaint').trim().isLength({ min: 2 }).withMessage('Complaint is required.'),
];

router.post(
  '/',
  visitValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { patientId, doctorId, specialityId, visitDate, visitTime, visitType, complaint, diagnosis, treatment, notes } = req.body;

    const patientCheck = await query('SELECT patient_id FROM patients WHERE patient_id = $1', [patientId]);
    if (!patientCheck.rows[0]) throw new AppError('Selected patient does not exist.', 404);

    const visitId = await nextId('visit');
    const { rows } = await query(
      `INSERT INTO patient_visits (visit_id, patient_id, doctor_id, speciality_id, visit_date, visit_time,
        visit_type, complaint, diagnosis, treatment, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SCHEDULED') RETURNING *`,
      [visitId, patientId, doctorId, specialityId, visitDate, visitTime, visitType, complaint, diagnosis || null, treatment || null, notes || null]
    );

    await writeAudit(null, { adminId: req.admin.adminId, action: 'CREATE', entityType: 'VISIT', entityId: visitId, description: `Created ${visitType} visit for patient ${patientId}.` });
    res.status(201).json({ success: true, data: rows[0] });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { diagnosis, treatment, notes, status } = req.body;
    if (status && !['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      throw new AppError('Invalid status.', 422);
    }
    const { rows } = await query(
      `UPDATE patient_visits SET diagnosis=COALESCE($1,diagnosis), treatment=COALESCE($2,treatment),
        notes=COALESCE($3,notes), status=COALESCE($4,status), updated_at=NOW()
       WHERE visit_id=$5 RETURNING *`,
      [diagnosis, treatment, notes, status, id]
    );
    if (!rows[0]) throw new AppError('Visit not found.', 404);
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'VISIT', entityId: id, description: `Updated visit ${id}.` });
    res.json({ success: true, data: rows[0] });
  })
);

module.exports = router;
