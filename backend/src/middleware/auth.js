const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT sent in the Authorization: Bearer <token> header.
 * Attaches { adminId, email, role } to req.admin on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No authentication token provided.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
}

/** Restrict a route to SUPER_ADMIN only. */
function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'Super admin privileges required.' });
  }
  next();
}

module.exports = { authenticate, requireSuperAdmin };
