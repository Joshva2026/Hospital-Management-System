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
  const { date = '', doctorId = '', status = '', patientId = '', page = 1, limit = 10 } = req.query;
  const conditions = [];
  const params = [];
  if (date) { params.push(date); conditions.push(`ap.appointment_date = $${params.length}`); }
  if (doctorId) { params.push(doctorId); conditions.push(`ap.doctor_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`ap.status = $${params.length}`); }
  if (patientId) { params.push(patientId); conditions.push(`ap.patient_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM appointments ap ${where}`, params);
  params.push(limitNum, offset);
  const { rows } = await query(
    `SELECT ap.*, p.full_name AS patient_name, d.doctor_name, s.speciality_name
     FROM appointments ap
     JOIN patients p ON p.patient_id = ap.patient_id
     JOIN doctors d ON d.doctor_id = ap.doctor_id
     JOIN specialities s ON s.speciality_id = ap.speciality_id
     ${where} ORDER BY ap.appointment_date DESC, ap.appointment_time DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, data: rows, pagination: { page: pageNum, limit: limitNum, total: countRes.rows[0].total, totalPages: Math.ceil(countRes.rows[0].total / limitNum) } });
}));

const appointmentValidators = [
  body('patientId').notEmpty().withMessage('Patient is required.'),
  body('doctorId').notEmpty().withMessage('Doctor is required.'),
  body('specialityId').notEmpty().withMessage('Speciality is required.'),
  body('appointmentDate').isISO8601().withMessage('A valid appointment date is required.'),
  body('appointmentTime').notEmpty().withMessage('Appointment time is required.'),
];

router.post(
  '/',
  appointmentValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { patientId, doctorId, specialityId, appointmentDate, appointmentTime, appointmentType, reason } = req.body;

    // Friendly pre-check (the DB unique index is the authoritative guard).
    const conflict = await query(
      `SELECT appointment_id FROM appointments
       WHERE doctor_id=$1 AND appointment_date=$2 AND appointment_time=$3 AND status='SCHEDULED'`,
      [doctorId, appointmentDate, appointmentTime]
    );
    if (conflict.rows[0]) throw new AppError('This doctor already has a scheduled appointment at that date and time.', 409);

    const appointmentId = await nextId('appointment');
    const { rows } = await query(
      `INSERT INTO appointments (appointment_id, patient_id, doctor_id, speciality_id, appointment_date,
        appointment_time, appointment_type, reason, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SCHEDULED') RETURNING *`,
      [appointmentId, patientId, doctorId, specialityId, appointmentDate, appointmentTime, appointmentType || 'CONSULTATION', reason || null]
    );

    await writeAudit(null, { adminId: req.admin.adminId, action: 'CREATE', entityType: 'APPOINTMENT', entityId: appointmentId, description: `Scheduled appointment for patient ${patientId} with ${doctorId}.` });
    res.status(201).json({ success: true, data: rows[0] });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { appointmentDate, appointmentTime, reason } = req.body;
    const { rows } = await query(
      `UPDATE appointments SET appointment_date=COALESCE($1,appointment_date), appointment_time=COALESCE($2,appointment_time),
        reason=COALESCE($3,reason), updated_at=NOW() WHERE appointment_id=$4 AND status='SCHEDULED' RETURNING *`,
      [appointmentDate, appointmentTime, reason, id]
    );
    if (!rows[0]) throw new AppError('Appointment not found or cannot be edited (already completed/cancelled).', 404);
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'APPOINTMENT', entityId: id, description: `Rescheduled appointment ${id}.` });
    res.json({ success: true, data: rows[0] });
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) throw new AppError('Invalid status.', 422);
    const { rows } = await query(
      `UPDATE appointments SET status=$1, updated_at=NOW() WHERE appointment_id=$2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) throw new AppError('Appointment not found.', 404);
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'APPOINTMENT', entityId: id, description: `Appointment ${id} marked ${status}.` });
    res.json({ success: true, data: rows[0] });
  })
);

module.exports = router;
