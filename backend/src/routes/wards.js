const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

async function nextWardId() {
  const { rows } = await query("SELECT nextval('wards_seq') AS seq");
  return 'WARD-' + String(rows[0].seq).padStart(3, '0');
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

router.put(
  '/:id',
  [
    body('wardName').trim().isLength({ min: 2 }).withMessage('Ward name is required.'),
    body('wardType').notEmpty().withMessage('Ward type is required.'),
    body('totalBeds').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Total beds must be a positive integer.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { id } = req.params;
    const { wardName, wardType, floor, totalBeds, status } = req.body;

    const { rows: current } = await query('SELECT * FROM wards WHERE ward_id = $1', [id]);
    if (!current[0]) throw new AppError('Ward not found.', 404);

    // Validate duplicate name
    const { rows: dupCheck } = await query('SELECT * FROM wards WHERE ward_name = $1 AND ward_id != $2', [wardName, id]);
    if (dupCheck.length > 0) throw new AppError('A ward with this name already exists.', 409);

    if (totalBeds !== undefined && totalBeds !== null) {
      const { rows: bedCheck } = await query('SELECT COUNT(*) FROM beds WHERE ward_id = $1', [id]);
      const currentBeds = parseInt(bedCheck[0].count, 10);
      if (totalBeds < currentBeds) {
        throw new AppError(`Cannot reduce total beds to ${totalBeds}. There are currently ${currentBeds} bed records assigned to this ward.`, 409);
      }
    }

    const newTotalBeds = (totalBeds !== undefined && totalBeds !== null) ? totalBeds : current[0].total_beds;
    const newStatus = status || current[0].status;

    const { rows } = await query(
      `UPDATE wards SET ward_name=$1, ward_type=$2, floor=$3, total_beds=$4, status=$5, updated_at=NOW() WHERE ward_id=$6 RETURNING *`,
      [wardName, wardType, floor || null, newTotalBeds, newStatus, id]
    );

    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'WARD', entityId: id, description: `Updated ward ${wardName}.` });
    res.json({ success: true, data: rows[0] });
  })
);

module.exports = router;
