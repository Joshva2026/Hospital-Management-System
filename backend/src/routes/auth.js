const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');

const router = express.Router();

// Brute-force protection on login attempts (per-IP).
const loginLimiter = rateLimit({
  windowMs: (Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').isLength({ min: 1 }).withMessage('Password is required.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase().trim()]);
    const admin = rows[0];

    // Same generic message whether email doesn't exist or password is wrong -
    // never reveal which one was incorrect.
    const genericError = 'Invalid email or password.';

    if (!admin) throw new AppError(genericError, 401);
    if (admin.status !== 'ACTIVE') throw new AppError('This account has been deactivated.', 403);

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const minsLeft = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
      throw new AppError(`Account temporarily locked. Try again in ${minsLeft} minute(s).`, 403);
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);

    if (!validPassword) {
      const attempts = admin.failed_login_attempts + 1;
      const lockUntil = attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;
      await query(
        'UPDATE admins SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE admin_id = $3',
        [attempts, lockUntil, admin.admin_id]
      );
      throw new AppError(genericError, 401);
    }

    // Successful login - reset counters, issue token, log it.
    await query(
      'UPDATE admins SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE admin_id = $1',
      [admin.admin_id]
    );

    const token = jwt.sign(
      { adminId: admin.admin_id, email: admin.email, fullName: admin.full_name, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await writeAudit(null, {
      adminId: admin.admin_id,
      action: 'LOGIN',
      description: `Administrator ${admin.full_name} logged in.`,
    });

    res.json({
      success: true,
      token,
      admin: { adminId: admin.admin_id, fullName: admin.full_name, email: admin.email, role: admin.role },
    });
  })
);

// POST /api/auth/logout  (client discards token; we just record the audit trail)
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await writeAudit(null, {
      adminId: req.admin.adminId,
      action: 'LOGOUT',
      description: `Administrator ${req.admin.fullName} logged out.`,
    });
    res.json({ success: true, message: 'Logged out successfully.' });
  })
);

// GET /api/auth/me  (used by frontend on refresh to validate session + get profile)
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'SELECT admin_id, full_name, email, role, status FROM admins WHERE admin_id = $1',
      [req.admin.adminId]
    );
    if (!rows[0]) throw new AppError('Admin not found.', 404);
    res.json({ success: true, admin: rows[0] });
  })
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { currentPassword, newPassword } = req.body;
    const { rows } = await query('SELECT * FROM admins WHERE admin_id = $1', [req.admin.adminId]);
    const admin = rows[0];

    const valid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!valid) throw new AppError('Current password is incorrect.', 401);

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE admin_id = $2', [newHash, admin.admin_id]);

    await writeAudit(null, { adminId: admin.admin_id, action: 'UPDATE', entityType: 'ADMIN', entityId: admin.admin_id, description: 'Password changed.' });

    res.json({ success: true, message: 'Password updated successfully.' });
  })
);

// PUT /api/auth/profile
router.put(
  '/profile',
  authenticate,
  [
    body('fullName').notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { fullName, email } = req.body;
    
    // Check if email is used by another admin
    const emailCheck = await query('SELECT admin_id FROM admins WHERE email = $1 AND admin_id != $2', [email.toLowerCase().trim(), req.admin.adminId]);
    if (emailCheck.rows.length > 0) throw new AppError('Email is already in use by another account.', 409);

    await query('UPDATE admins SET full_name = $1, email = $2, updated_at = NOW() WHERE admin_id = $3', [fullName, email.toLowerCase().trim(), req.admin.adminId]);

    await writeAudit(null, { adminId: req.admin.adminId, action: 'UPDATE', entityType: 'ADMIN', entityId: req.admin.adminId, description: 'Profile updated.' });

    // Return the updated info
    const { rows } = await query('SELECT admin_id, full_name, email, role, status FROM admins WHERE admin_id = $1', [req.admin.adminId]);
    
    res.json({ success: true, message: 'Profile updated successfully.', admin: rows[0] });
  })
);

module.exports = router;
