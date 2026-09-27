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
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const { rows: countRows } = await query(`SELECT COUNT(*) FROM discharges`);
  const total = parseInt(countRows[0].count, 10);
  const totalPages = Math.ceil(total / limitNum);

  const { rows } = await query(
    `SELECT dis.*, p.full_name AS patient_name FROM discharges dis
     JOIN patients p ON p.patient_id = dis.patient_id
     ORDER BY dis.discharge_date DESC
     LIMIT $1 OFFSET $2`,
    [limitNum, offset]
  );
  res.json({ success: true, data: rows, page: pageNum, limit: limitNum, total, totalPages });
}));

const dischargeValidators = [
  body('admissionId').notEmpty().withMessage('Admission is required.'),
  body('dischargeType').notEmpty().withMessage('Discharge type is required.'),
  body('finalDiagnosis').trim().isLength({ min: 2 }).withMessage('Final diagnosis is required.'),
];

// POST /api/discharges
// CRITICAL FLOW (single DB transaction):
//   1. Lock the admission row; verify it is still ADMITTED.
//   2. Insert discharge record (backend-generated ID).
//   3. Flip admission -> DISCHARGED, stamp discharge_date/time.
//   4. Flip patient -> DISCHARGED.
//   5. Flip bed -> AVAILABLE, clear current_patient_id.
//   6. Write audit log.
router.post(
  '/',
  dischargeValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { admissionId, dischargeType, finalDiagnosis, treatmentSummary, doctorAdvice, followUpDate } = req.body;

    const result = await withTransaction(async (client) => {
      const admissionResult = await client.query('SELECT * FROM admissions WHERE admission_id = $1 FOR UPDATE', [admissionId]);
      const admission = admissionResult.rows[0];
      if (!admission) throw new AppError('Admission not found.', 404);
      if (admission.status !== 'ADMITTED') throw new AppError('This admission has already been discharged.', 409);

      const dischargeId = await nextId('discharge', client);

      const dischargeResult = await client.query(
        `INSERT INTO discharges (discharge_id, admission_id, patient_id, discharge_date, discharge_time,
          discharge_type, final_diagnosis, treatment_summary, doctor_advice, follow_up_date, status)
         VALUES ($1,$2,$3, CURRENT_DATE, CURRENT_TIME, $4,$5,$6,$7,$8,'FINALIZED') RETURNING *`,
        [dischargeId, admissionId, admission.patient_id, dischargeType, finalDiagnosis,
          treatmentSummary || null, doctorAdvice || null, followUpDate || null]
      );

      await client.query(
        `UPDATE admissions SET status='DISCHARGED', discharge_date=CURRENT_DATE, discharge_time=CURRENT_TIME, updated_at=NOW()
         WHERE admission_id=$1`,
        [admissionId]
      );

      await client.query(
        `UPDATE patients SET status='DISCHARGED', patient_type='DISCHARGED', updated_at=NOW() WHERE patient_id=$1`,
        [admission.patient_id]
      );

      await client.query(
        `UPDATE beds SET status='AVAILABLE', current_patient_id=NULL, last_updated=NOW() WHERE bed_id=$1`,
        [admission.bed_id]
      );

      await writeAudit(client, {
        adminId: req.admin.adminId, action: 'CREATE', entityType: 'DISCHARGE', entityId: dischargeId,
        description: `Discharged patient ${admission.patient_id} from admission ${admissionId}; bed ${admission.bed_id} released.`,
      });

      return dischargeResult.rows[0];
    });

    res.status(201).json({ success: true, data: result });
  })
);

// PUT /api/discharges/:id
// Safely allows editing of clinical text fields after discharge is finalized,
// without affecting the underlying patient/bed/admission state machine.
router.put(
  '/:id',
  [
    body('dischargeType').notEmpty().withMessage('Discharge type is required.'),
    body('finalDiagnosis').trim().isLength({ min: 2 }).withMessage('Final diagnosis is required.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { id } = req.params;
    const { dischargeType, finalDiagnosis, treatmentSummary, doctorAdvice, followUpDate } = req.body;

    const { rows: current } = await query('SELECT * FROM discharges WHERE discharge_id = $1', [id]);
    if (!current[0]) throw new AppError('Discharge record not found.', 404);
    
    // We do NOT update discharge_date or discharge_time to preserve integrity with admissions.
    const { rows } = await query(
      `UPDATE discharges SET 
        discharge_type=$1, final_diagnosis=$2, treatment_summary=$3, 
        doctor_advice=$4, follow_up_date=$5, updated_at=NOW() 
       WHERE discharge_id=$6 RETURNING *`,
      [dischargeType, finalDiagnosis, treatmentSummary || null, doctorAdvice || null, followUpDate || null, id]
    );

    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'DISCHARGE', entityId: id, description: `Updated discharge summary for ${id}.` });
    res.json({ success: true, data: rows[0] });
  })
);

module.exports = router;
