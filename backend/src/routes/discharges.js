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
  const { rows } = await query(
    `SELECT dis.*, p.full_name AS patient_name FROM discharges dis
     JOIN patients p ON p.patient_id = dis.patient_id
     ORDER BY dis.discharge_date DESC`
  );
  res.json({ success: true, data: rows });
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

module.exports = router;
