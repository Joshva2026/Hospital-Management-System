const express = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/audit-logs?adminId=&action=&entityType=&page=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const { adminId = '', action = '', entityType = '', page = 1, limit = 20 } = req.query;
  const conditions = [];
  const params = [];
  if (adminId) { params.push(adminId); conditions.push(`al.admin_id = $${params.length}`); }
  if (action) { params.push(action); conditions.push(`al.action = $${params.length}`); }
  if (entityType) { params.push(entityType); conditions.push(`al.entity_type = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM audit_logs al ${where}`, params);
  params.push(limitNum, offset);
  const { rows } = await query(
    `SELECT al.*, a.full_name AS admin_name FROM audit_logs al
     LEFT JOIN admins a ON a.admin_id = al.admin_id
     ${where} ORDER BY al.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, data: rows, pagination: { page: pageNum, limit: limitNum, total: countRes.rows[0].total, totalPages: Math.ceil(countRes.rows[0].total / limitNum) } });
}));

module.exports = router;
