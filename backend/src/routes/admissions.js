const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, withTransaction } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { nextId } = require('../utils/idGenerator');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { status = '', patientId = '', page = 1, limit = 10 } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`a.status = $${params.length}`); }
  if (patientId) { params.push(patientId); conditions.push(`a.patient_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM admissions a ${where}`, params);
  params.push(limitNum, offset);
  const { rows } = await query(
    `SELECT a.*, p.full_name AS patient_name, d.doctor_name, w.ward_name, b.bed_number
     FROM admissions a
     JOIN patients p ON p.patient_id = a.patient_id
     JOIN doctors d ON d.doctor_id = a.doctor_id
     JOIN wards w ON w.ward_id = a.ward_id
     JOIN beds b ON b.bed_id = a.bed_id
     ${where} ORDER BY a.admission_date DESC, a.admission_time DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, data: rows, pagination: { page: pageNum, limit: limitNum, total: countRes.rows[0].total, totalPages: Math.ceil(countRes.rows[0].total / limitNum) } });
}));

const admissionValidators = [
  body('patientId').notEmpty().withMessage('Patient is required.'),
  body('doctorId').notEmpty().withMessage('Doctor is required.'),
  body('specialityId').notEmpty().withMessage('Speciality is required.'),
  body('wardId').notEmpty().withMessage('Ward is required.'),
  body('bedId').notEmpty().withMessage('Bed is required.'),
  body('admissionReason').trim().isLength({ min: 2 }).withMessage('Admission reason is required.'),
];

// POST /api/admissions
// CRITICAL FLOW (single DB transaction):
//   1. Lock the chosen bed row (SELECT ... FOR UPDATE) so two simultaneous
//      admission requests for the same bed cannot both succeed.
//   2. Verify bed is still AVAILABLE and patient has no existing active admission.
//   3. Insert admission row (backend-generated ID).
//   4. Flip bed -> OCCUPIED + current_patient_id.
//   5. Flip patient -> ADMITTED.
//   6. Write audit log.
//   If ANY step fails, the whole transaction rolls back - no partial state.
router.post(
  '/',
  admissionValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { patientId, doctorId, specialityId, wardId, bedId, admissionReason, initialCondition } = req.body;

    const result = await withTransaction(async (client) => {
      // Lock the bed row for the duration of this transaction.
      const bedResult = await client.query('SELECT * FROM beds WHERE bed_id = $1 FOR UPDATE', [bedId]);
      const bed = bedResult.rows[0];
      if (!bed) throw new AppError('Selected bed does not exist.', 404);
      if (bed.status !== 'AVAILABLE') throw new AppError(`Bed ${bedId} is currently ${bed.status} and cannot be assigned.`, 409);
      if (bed.ward_id !== wardId) throw new AppError('Selected bed does not belong to the selected ward.', 422);

      const patientResult = await client.query('SELECT * FROM patients WHERE patient_id = $1 FOR UPDATE', [patientId]);
      const patient = patientResult.rows[0];
      if (!patient) throw new AppError('Selected patient does not exist.', 404);
      
      const activeAdm = await client.query('SELECT admission_id, ward_id, bed_id, admission_date FROM admissions WHERE patient_id = $1 AND status = $2 FOR UPDATE', [patientId, 'ADMITTED']);
      if (activeAdm.rows.length > 0) {
        return { isConflict: true, admission: activeAdm.rows[0] };
      }

      const admissionId = await nextId('admission', client);

      const admissionResult = await client.query(
        `INSERT INTO admissions (admission_id, patient_id, doctor_id, speciality_id, ward_id, bed_id,
          admission_date, admission_time, admission_reason, initial_condition, status)
         VALUES ($1,$2,$3,$4,$5,$6, CURRENT_DATE, CURRENT_TIME, $7, $8, 'ADMITTED') RETURNING *`,
        [admissionId, patientId, doctorId, specialityId, wardId, bedId, admissionReason, initialCondition || null]
      );

      await client.query(
        `UPDATE beds SET status='OCCUPIED', current_patient_id=$1, last_updated=NOW() WHERE bed_id=$2`,
        [patientId, bedId]
      );

      await client.query(
        `UPDATE patients SET status='ADMITTED', patient_type='ADMITTED', updated_at=NOW() WHERE patient_id=$1`,
        [patientId]
      );

      await writeAudit(client, {
        adminId: req.admin.adminId, action: 'CREATE', entityType: 'ADMISSION', entityId: admissionId,
        description: `Admitted patient ${patientId} to bed ${bedId} (${wardId}).`,
      });

      return admissionResult.rows[0];
    });

    if (result.isConflict) {
      return res.status(409).json({
        error: 'PATIENT_ALREADY_ADMITTED',
        message: 'This patient is already admitted.',
        admission: result.admission
      });
    }

    res.status(201).json({ success: true, data: result });
  })
);

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, p.full_name AS patient_name, d.doctor_name, w.ward_name, b.bed_number
     FROM admissions a
     JOIN patients p ON p.patient_id = a.patient_id
     JOIN doctors d ON d.doctor_id = a.doctor_id
     JOIN wards w ON w.ward_id = a.ward_id
     JOIN beds b ON b.bed_id = a.bed_id
     WHERE a.admission_id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('Admission not found.', 404);
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
