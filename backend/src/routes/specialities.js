const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

let seqCounter = null; // speciality IDs are simple SPEC-### - generated via a helper below

async function nextSpecialityId() {
  const { rows } = await query(
    `SELECT speciality_id FROM specialities ORDER BY speciality_id DESC LIMIT 1`
  );
  let next = 1;
  if (rows[0]) {
    const num = parseInt(rows[0].speciality_id.split('-')[1], 10);
    next = num + 1;
  }
  return `SPEC-${String(next).padStart(3, '0')}`;
}

router.get('/', asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const where = includeInactive === 'true' ? '' : `WHERE status = 'ACTIVE'`;
  const { rows } = await query(`SELECT * FROM specialities ${where} ORDER BY speciality_name ASC`);
  res.json({ success: true, data: rows });
}));

router.post(
  '/',
  [body('specialityName').trim().isLength({ min: 2 }).withMessage('Speciality name is required.')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { specialityName, departmentDescription } = req.body;
    const id = await nextSpecialityId();
    const { rows } = await query(
      `INSERT INTO specialities (speciality_id, speciality_name, department_description) VALUES ($1,$2,$3) RETURNING *`,
      [id, specialityName, departmentDescription || null]
    );
    await writeAudit(null, { adminId: req.admin.adminId, action: 'CREATE', entityType: 'SPECIALITY', entityId: id, description: `Created speciality ${specialityName}.` });
    res.status(201).json({ success: true, data: rows[0] });
  })
);

router.put(
  '/:id',
  [body('specialityName').trim().isLength({ min: 2 }).withMessage('Speciality name is required.')],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { specialityName, departmentDescription } = req.body;
    const { rows } = await query(
      `UPDATE specialities SET speciality_name=$1, department_description=$2, updated_at=NOW() WHERE speciality_id=$3 RETURNING *`,
      [specialityName, departmentDescription || null, id]
    );
    if (!rows[0]) throw new AppError('Speciality not found.', 404);
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'SPECIALITY', entityId: id, description: `Updated speciality ${id}.` });
    res.json({ success: true, data: rows[0] });
  })
);

// Deactivate instead of delete - specialities are referenced by doctors/visits/etc.
router.patch(
  '/:id/deactivate',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rows } = await query(
      `UPDATE specialities SET status='INACTIVE', updated_at=NOW() WHERE speciality_id=$1 RETURNING *`,
      [id]
    );
    if (!rows[0]) throw new AppError('Speciality not found.', 404);
    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'SPECIALITY', entityId: id, description: `Deactivated speciality ${id}.` });
    res.json({ success: true, data: rows[0] });
  })
);

router.patch(
  '/:id/activate',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rows } = await query(
      `UPDATE specialities SET status='ACTIVE', updated_at=NOW() WHERE speciality_id=$1 RETURNING *`,
      [id]
    );
    if (!rows[0]) throw new AppError('Speciality not found.', 404);
    res.json({ success: true, data: rows[0] });
  })
);

module.exports = router;
