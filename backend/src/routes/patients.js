const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, withTransaction } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { nextId } = require('../utils/idGenerator');
const { writeAudit } = require('../utils/audit');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticate);

const SORTABLE = ['full_name', 'registration_date', 'patient_id', 'patient_type', 'status', 'age'];

// GET /api/patients?search=&status=&patientType=&gender=&page=&limit=&sortBy=&sortDir=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      search = '', status = '', patientType = '', gender = '',
      page = 1, limit = 10, sortBy = 'registration_date', sortDir = 'desc',
    } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(p.full_name ILIKE $${params.length} OR p.mobile ILIKE $${params.length} OR p.patient_id ILIKE $${params.length})`);
    }
    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
    if (patientType) { params.push(patientType); conditions.push(`p.patient_type = $${params.length}`); }
    if (gender) { params.push(gender); conditions.push(`p.gender = $${params.length}`); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeSort = SORTABLE.includes(sortBy) && sortBy !== 'age' ? sortBy : 'created_at';
    const safeDir = sortDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const countResult = await query(`SELECT COUNT(*)::int AS total FROM patients p ${whereClause}`, params);
    const total = countResult.rows[0].total;

    params.push(limitNum, offset);
    const { rows } = await query(
      `SELECT p.patient_id, p.full_name, p.mobile, p.gender, p.date_of_birth,
              DATE_PART('year', AGE(p.date_of_birth)) AS age,
              p.blood_group, p.problem, p.patient_type, p.registration_date, p.status,
              (
                SELECT row_to_json(curr_adm) 
                FROM (
                  SELECT a.admission_id, w.ward_name, b.bed_number, a.status, a.admission_date
                  FROM admissions a
                  LEFT JOIN wards w ON w.ward_id = a.ward_id
                  LEFT JOIN beds b ON b.bed_id = a.bed_id
                  WHERE a.patient_id = p.patient_id AND a.status = 'ADMITTED'
                  LIMIT 1
                ) curr_adm
              ) AS current_admission
       FROM patients p
       ${whereClause}
       ORDER BY p.${safeSort} ${safeDir}, p.created_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  })
);

// GET /api/patients/:id  -> full profile incl. history (used by Patient Profile screen)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const patientResult = await query('SELECT * FROM patients WHERE patient_id = $1', [id]);
    if (!patientResult.rows[0]) throw new AppError('Patient not found.', 404);

    const [visits, admissions, discharges, appointments, reports] = await Promise.all([
      query(`SELECT v.*, d.doctor_name, s.speciality_name FROM patient_visits v
             JOIN doctors d ON d.doctor_id = v.doctor_id
             JOIN specialities s ON s.speciality_id = v.speciality_id
             WHERE v.patient_id = $1 ORDER BY v.visit_date DESC, v.visit_time DESC`, [id]),
      query(`SELECT a.*, d.doctor_name, w.ward_name, b.bed_number FROM admissions a
             JOIN doctors d ON d.doctor_id = a.doctor_id
             JOIN wards w ON w.ward_id = a.ward_id
             JOIN beds b ON b.bed_id = a.bed_id
             WHERE a.patient_id = $1 ORDER BY a.admission_date DESC`, [id]),
      query('SELECT * FROM discharges WHERE patient_id = $1 ORDER BY discharge_date DESC', [id]),
      query(`SELECT ap.*, d.doctor_name FROM appointments ap
             JOIN doctors d ON d.doctor_id = ap.doctor_id
             WHERE ap.patient_id = $1 ORDER BY ap.appointment_date DESC`, [id]),
      query(`SELECT r.* FROM daily_patient_reports r WHERE r.patient_id = $1 ORDER BY r.report_date DESC`, [id]),
    ]);

    res.json({
      success: true,
      data: {
        patient: patientResult.rows[0],
        visits: visits.rows,
        admissions: admissions.rows,
        discharges: discharges.rows,
        appointments: appointments.rows,
        dailyReports: reports.rows,
      },
    });
  })
);

const patientValidators = [
  body('fullName').trim().isLength({ min: 2, max: 150 }).withMessage('Full name is required (min 2 characters).'),
  body('mobile').trim().matches(/^[0-9]{10}$/).withMessage('Mobile must be a 10-digit number.'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female or Other.'),
  body('dateOfBirth').optional({ nullable: true }).isISO8601().withMessage('Date of birth must be a valid date.'),
  body('bloodGroup').optional({ nullable: true }).trim(),
  body('emergencyContact').optional({ nullable: true }).trim().matches(/^[0-9]{10}$/).withMessage('Emergency contact must be a 10-digit number.'),
  body('patientType').isIn(['OPD', 'EMERGENCY']).withMessage('Patient type must be OPD or EMERGENCY.'),
];

// POST /api/patients  -> ID is ALWAYS generated server-side. Client cannot supply one.
router.post(
  '/',
  patientValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const {
      fullName, mobile, gender, dateOfBirth, address, bloodGroup,
      emergencyContact, problem, reasonForVisit, patientType, force
    } = req.body;

    const result = await withTransaction(async (client) => {
      // 1. Obtain a transaction-level advisory lock based on the mobile number (or fullName if missing)
      // This ensures concurrent requests with the same mobile number queue up and serialize.
      const lockKeyStr = (mobile || fullName || 'global').substring(0, 32);
      const lockKey = crypto.createHash('md5').update(lockKeyStr).digest().readInt32BE(0);
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      // Duplicate detection (Unconditional - no force override)
      const dupQuery = `
        SELECT p.*,
          (
            SELECT row_to_json(curr_adm) 
            FROM (
              SELECT a.admission_id, w.ward_name, b.bed_number, a.status, a.admission_date
              FROM admissions a
              LEFT JOIN wards w ON w.ward_id = a.ward_id
              LEFT JOIN beds b ON b.bed_id = a.bed_id
              WHERE a.patient_id = p.patient_id AND a.status = 'ADMITTED'
              LIMIT 1
            ) curr_adm
          ) AS current_admission
        FROM patients p
        WHERE p.status = 'ACTIVE' 
        AND (
          p.mobile = $1
          OR (p.full_name ILIKE $2 AND p.date_of_birth = $3)
          OR (p.full_name ILIKE $2 AND p.mobile = $1)
          OR (p.emergency_contact = $4 AND p.emergency_contact IS NOT NULL AND p.emergency_contact != '')
        )
        LIMIT 1
      `;
      const { rows: dups } = await client.query(dupQuery, [mobile, fullName, dateOfBirth || null, emergencyContact || null]);
      if (dups.length > 0) {
        return {
          success: false,
          isDuplicate: true,
          message: 'Patient already exists.',
          duplicate: dups[0]
        };
      }

      const patientId = await nextId('patient', client);

      const { rows } = await client.query(
        `INSERT INTO patients
          (patient_id, full_name, mobile, gender, date_of_birth, address, blood_group,
           emergency_contact, problem, reason_for_visit, patient_type, registration_date, registration_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CURRENT_DATE, CURRENT_TIME)
         RETURNING *`,
        [patientId, fullName, mobile, gender, dateOfBirth || null, address || null, bloodGroup || null,
          emergencyContact || null, problem || null, reasonForVisit || null, patientType]
      );

      await writeAudit(client, {
        adminId: req.admin.adminId, action: 'CREATE', entityType: 'PATIENT', entityId: patientId,
        description: `Registered new patient ${fullName} (${patientId}). ${force ? '[DUPLICATE OVERRIDE]' : ''}`,
      });

      return { success: true, data: rows[0] };
    });

    if (result.isDuplicate) {
      return res.status(409).json(result);
    }
    res.status(201).json(result);
  })
);

// PUT /api/patients/:id
router.put(
  '/:id',
  patientValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { id } = req.params;
    const {
      fullName, mobile, gender, dateOfBirth, address, bloodGroup,
      emergencyContact, problem, reasonForVisit, patientType,
    } = req.body;

    const { rows } = await query(
      `UPDATE patients SET full_name=$1, mobile=$2, gender=$3, date_of_birth=$4, address=$5,
        blood_group=$6, emergency_contact=$7, problem=$8, reason_for_visit=$9, patient_type=$10,
        updated_at = NOW()
       WHERE patient_id = $11 RETURNING *`,
      [fullName, mobile, gender, dateOfBirth || null, address || null, bloodGroup || null,
        emergencyContact || null, problem || null, reasonForVisit || null, patientType, id]
    );
    if (!rows[0]) throw new AppError('Patient not found.', 404);

    await writeAudit(null, {
      adminId: req.admin.adminId, action: 'UPDATE', entityType: 'PATIENT', entityId: id,
      description: `Updated details for patient ${id}.`,
    });

    res.json({ success: true, data: rows[0] });
  })
);

// GET /api/patients/duplicates/list (Special endpoint for finding duplicate groups)
router.get(
  '/duplicates/list',
  asyncHandler(async (req, res) => {
    // Find patients with same mobile
    const { rows } = await query(`
      SELECT mobile, array_agg(patient_id) as ids, array_agg(full_name) as names 
      FROM patients 
      WHERE status = 'ACTIVE' AND mobile IS NOT NULL AND mobile != ''
      GROUP BY mobile 
      HAVING COUNT(*) > 1
    `);
    
    res.json({ success: true, duplicates: rows });
  })
);

// DELETE /api/patients/:id  (Hard delete if safe, otherwise suggest deactivate)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const [visits, admissions, reports] = await Promise.all([
      query('SELECT 1 FROM patient_visits WHERE patient_id = $1 LIMIT 1', [id]),
      query('SELECT 1 FROM admissions WHERE patient_id = $1 LIMIT 1', [id]),
      query('SELECT 1 FROM daily_patient_reports WHERE patient_id = $1 LIMIT 1', [id])
    ]);
    
    if (visits.rows.length > 0 || admissions.rows.length > 0 || reports.rows.length > 0) {
      throw new AppError('Patient has historical clinical records and cannot be permanently deleted. Please deactivate instead.', 400);
    }
    
    const patientResult = await query('SELECT full_name FROM patients WHERE patient_id = $1', [id]);
    if (!patientResult.rows[0]) throw new AppError('Patient not found.', 404);
    
    await query('DELETE FROM patients WHERE patient_id = $1', [id]);
    
    await writeAudit(null, {
      adminId: req.admin.adminId, action: 'DELETE', entityType: 'PATIENT', entityId: id,
      description: `Deleted patient ${patientResult.rows[0].full_name} (${id}).`,
    });
    
    res.json({ success: true, message: 'Patient deleted successfully.' });
  })
);

// PATCH /api/patients/:id/status (Deactivate workflow)
router.patch(
  '/:id/status',
  [body('status').isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { id } = req.params;
    const { status } = req.body;
    
    const { rows } = await query('UPDATE patients SET status = $1, updated_at = NOW() WHERE patient_id = $2 RETURNING full_name', [status, id]);
    if (!rows[0]) throw new AppError('Patient not found.', 404);
    
    await writeAudit(null, {
      adminId: req.admin.adminId, action: 'UPDATE', entityType: 'PATIENT', entityId: id,
      description: `Patient ${rows[0].full_name} (${id}) status changed to ${status}.`,
    });
    
    res.json({ success: true, message: `Patient ${status === 'INACTIVE' ? 'deactivated' : 'activated'} successfully.` });
  })
);

module.exports = router;
