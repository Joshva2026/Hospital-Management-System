const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { query } = require('../config/db');
const { answer, MENU } = require('../services/quickDesk');

const router = express.Router();
router.use(authenticate);

// Menu buttons for the chat
router.get('/menu', (req, res) => res.json({ success: true, data: MENU }));

// Answer one question (no AI)
router.post('/ask', asyncHandler(async (req, res) => {
  const message = typeof req.body.message === 'string' ? req.body.message.slice(0, 300) : '';
  const result = await answer(message);
  res.json({ success: true, ...result });
}));

// Hospital info (read)
router.get('/hospital-info', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT key, value, updated_at FROM hospital_info ORDER BY key');
  res.json({ success: true, data: rows });
}));

// Hospital info (update one value)
router.put('/hospital-info/:key', asyncHandler(async (req, res) => {
  const value = typeof req.body.value === 'string' ? req.body.value.trim() : '';
  if (!value || value.length > 1000) throw new AppError('Value must be 1 to 1000 characters.', 400);
  const { rows } = await query(
    'UPDATE hospital_info SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING key, value',
    [value, req.params.key]
  );
  if (!rows.length) throw new AppError('Unknown setting.', 404);
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;

