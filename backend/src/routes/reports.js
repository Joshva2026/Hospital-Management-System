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
  const { admissionId = '', patientId = '' } = req.query;
  const conditions = [];
  const params = [];
  if (admissionId) { params.push(admissionId); conditions.push(`r.admission_id = $${params.length}`); }
  if (patientId) { params.push(patientId); conditions.push(`r.patient_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT r.*, p.full_name AS patient_name FROM daily_patient_reports r
     JOIN patients p ON p.patient_id = r.patient_id
     ${where} ORDER BY r.report_date DESC, r.day_number DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

const reportValidators = [
  body('admissionId').notEmpty().withMessage('Admission is required.'),
  body('reportDate').isISO8601().withMessage('A valid report date is required.'),
  body('temperature').optional({ nullable: true }).isFloat().withMessage('Temperature must be a number.'),
  body('pulseRate').optional({ nullable: true }).isInt().withMessage('Pulse rate must be a number.'),
  body('spo2').optional({ nullable: true }).isInt({ min: 0, max: 100 }).withMessage('SpO2 must be between 0 and 100.'),
  body('patientCondition').notEmpty().withMessage('Patient condition is required.'),
];

// POST /api/reports
// Day number is auto-calculated as (report_date - admission_date) + 1.
// The DB UNIQUE(admission_id, report_date) constraint is the real guard against
// duplicates; we also pre-check here to return a clean, friendly error message.
router.post(
  '/',
  reportValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { admissionId, reportDate, temperature, bloodPressure, pulseRate, spo2,
      patientCondition, symptoms, treatmentGiven, doctorNotes, nextPlan } = req.body;

    const admissionResult = await query('SELECT * FROM admissions WHERE admission_id = $1', [admissionId]);
    const admission = admissionResult.rows[0];
    if (!admission) throw new AppError('Admission not found.', 404);
    if (admission.status !== 'ADMITTED') throw new AppError('Cannot add a daily report to a discharged admission.', 409);

    const dupCheck = await query(
      'SELECT report_id FROM daily_patient_reports WHERE admission_id = $1 AND report_date = $2',
      [admissionId, reportDate]
    );
    if (dupCheck.rows[0]) {
      throw new AppError(`A daily report for this admission on ${reportDate} already exists. Edit the existing report instead.`, 409);
    }

    const dayNumber = Math.floor(
      (new Date(reportDate) - new Date(admission.admission_date)) / (1000 * 60 * 60 * 24)
    ) + 1;
    if (dayNumber < 1) throw new AppError('Report date cannot be before the admission date.', 422);

    const reportId = await nextId('report');
    const { rows } = await query(
      `INSERT INTO daily_patient_reports
        (report_id, admission_id, patient_id, report_date, day_number, temperature, blood_pressure,
         pulse_rate, spo2, patient_condition, symptoms, treatment_given, doctor_notes, next_plan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [reportId, admissionId, admission.patient_id, reportDate, dayNumber, temperature || null,
        bloodPressure || null, pulseRate || null, spo2 || null, patientCondition, symptoms || null,
        treatmentGiven || null, doctorNotes || null, nextPlan || null]
    );

    await writeAudit(null, { adminId: req.admin.adminId, action: 'CREATE', entityType: 'DAILY_REPORT', entityId: reportId, description: `Added day ${dayNumber} report for admission ${admissionId}.` });
    res.status(201).json({ success: true, data: rows[0] });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { temperature, bloodPressure, pulseRate, spo2, patientCondition, symptoms, treatmentGiven, doctorNotes, nextPlan } = req.body;
    const { rows } = await query(
      `UPDATE daily_patient_reports SET
        temperature=COALESCE($1,temperature), blood_pressure=COALESCE($2,blood_pressure),
        pulse_rate=COALESCE($3,pulse_rate), spo2=COALESCE($4,spo2),
        patient_condition=COALESCE($5,patient_condition), symptoms=COALESCE($6,symptoms),
        treatment_given=COALESCE($7,treatment_given), doctor_notes=COALESCE($8,doctor_notes),
        next_plan=COALESCE($9,next_plan), updated_at=NOW()
       WHERE report_id=$10 RETURNING *`,
      [temperature, bloodPressure, pulseRate, spo2, patientCondition, symptoms, treatmentGiven, doctorNotes, nextPlan, id]
    );
    if (!rows[0]) throw new AppError('Report not found.', 404);
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'DAILY_REPORT', entityId: id, description: `Updated daily report ${id}.` });
    res.json({ success: true, data: rows[0] });
  })
);

module.exports = router;
