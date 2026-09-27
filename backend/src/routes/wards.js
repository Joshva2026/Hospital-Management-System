const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

async function nextWardId() {
  const { rows } = await query(`SELECT ward_id FROM wards ORDER BY ward_id DESC LIMIT 1`);
  let next = 1;
  if (rows[0]) next = parseInt(rows[0].ward_id.split('-')[1], 10) + 1;
  return `WARD-${String(next).padStart(3, '0')}`;
}

// GET /api/wards -> includes live occupancy counts computed from beds table
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT w.*,
      COUNT(b.bed_id) FILTER (WHERE b.status = 'AVAILABLE') AS available_beds,
      COUNT(b.bed_id) FILTER (WHERE b.status = 'OCCUPIED') AS occupied_beds,
      COUNT(b.bed_id) FILTER (WHERE b.status = 'MAINTENANCE') AS maintenance_beds,
      COUNT(b.bed_id) AS bed_count
    FROM wards w
    LEFT JOIN beds b ON b.ward_id = w.ward_id
    GROUP BY w.ward_id
    ORDER BY w.ward_name ASC
  `);
  res.json({ success: true, data: rows });
}));

router.post(
  '/',
  [
    body('wardName').trim().isLength({ min: 2 }).withMessage('Ward name is required.'),
    body('wardType').notEmpty().withMessage('Ward type is required.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);
    const { wardName, wardType, floor } = req.body;
    const id = await nextWardId();
    const { rows } = await query(
      `INSERT INTO wards (ward_id, ward_name, ward_type, floor, total_beds) VALUES ($1,$2,$3,$4,0) RETURNING *`,
      [id, wardName, wardType, floor || null]
    );
    await writeAudit(null, { adminId: req.admin.adminId, action: 'CREATE', entityType: 'WARD', entityId: id, description: `Created ward ${wardName}.` });
    res.status(201).json({ success: true, data: rows[0] });
  })
);

module.exports = router;
