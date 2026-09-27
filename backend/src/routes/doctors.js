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
  const { specialityId = '', status = '', search = '' } = req.query;
  const conditions = [];
  const params = [];
  if (specialityId) { params.push(specialityId); conditions.push(`d.speciality_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`d.doctor_name ILIKE $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT d.*, s.speciality_name FROM doctors d
     JOIN specialities s ON s.speciality_id = d.speciality_id
     ${where} ORDER BY d.doctor_name ASC`,
    params
  );
  res.json({ success: true, data: rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT d.*, s.speciality_name FROM doctors d JOIN specialities s ON s.speciality_id = d.speciality_id WHERE d.doctor_id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('Doctor not found.', 404);
  res.json({ success: true, data: rows[0] });
}));

const doctorValidators = [
  body('doctorName').trim().isLength({ min: 2 }).withMessage('Doctor name is required.'),
  body('specialityId').notEmpty().withMessage('Speciality is required.'),
  body('mobile').trim().matches(/^[0-9]{10}$/).withMessage('Mobile must be a 10-digit number.'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email must be valid.'),
  body('consultationFee').isFloat({ min: 0 }).withMessage('Consultation fee must be a positive number.'),
];

router.post(
  '/',
  doctorValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { doctorName, specialityId, qualification, experienceYears, mobile, email,
      consultationFee, availableDays, availableFrom, availableTo } = req.body;

    const doctorId = await nextId('doctor');
    const { rows } = await query(
      `INSERT INTO doctors (doctor_id, doctor_name, speciality_id, qualification, experience_years,
        mobile, email, consultation_fee, available_days, available_from, available_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [doctorId, doctorName, specialityId, qualification || null, experienceYears || 0, mobile,
        email || null, consultationFee, availableDays || null, availableFrom || null, availableTo || null]
    );
    await writeAudit(null, { adminId: req.admin.adminId, action: 'CREATE', entityType: 'DOCTOR', entityId: doctorId, description: `Added doctor ${doctorName}.` });
    res.status(201).json({ success: true, data: rows[0] });
  })
);

router.put(
  '/:id',
  doctorValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);
    const { id } = req.params;
    const { doctorName, specialityId, qualification, experienceYears, mobile, email,
      consultationFee, availableDays, availableFrom, availableTo, status } = req.body;

    const { rows } = await query(
      `UPDATE doctors SET doctor_name=$1, speciality_id=$2, qualification=$3, experience_years=$4,
        mobile=$5, email=$6, consultation_fee=$7, available_days=$8, available_from=$9, available_to=$10,
        status=COALESCE($11, status), updated_at=NOW()
       WHERE doctor_id=$12 RETURNING *`,
      [doctorName, specialityId, qualification || null, experienceYears || 0, mobile, email || null,
        consultationFee, availableDays || null, availableFrom || null, availableTo || null, status || null, id]
    );
    if (!rows[0]) throw new AppError('Doctor not found.', 404);
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'DOCTOR', entityId: id, description: `Updated doctor ${id}.` });
    res.json({ success: true, data: rows[0] });
  })
);

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new AppError('Status must be ACTIVE or INACTIVE.', 422);
  const { rows } = await query('UPDATE doctors SET status=$1, updated_at=NOW() WHERE doctor_id=$2 RETURNING *', [status, req.params.id]);
  if (!rows[0]) throw new AppError('Doctor not found.', 404);
  await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'DOCTOR', entityId: req.params.id, description: `Doctor status set to ${status}.` });
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
