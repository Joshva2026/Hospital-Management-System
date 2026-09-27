/**
 * Wraps an async route handler so thrown errors/rejected promises are
 * forwarded to Express's error handler instead of crashing the process.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Custom error carrying an HTTP status code. */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Express error-handling middleware (must be registered last). */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err.message);

  // PostgreSQL unique_violation
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'A record with these details already exists.' });
  }
  // PostgreSQL foreign_key_violation
  if (err.code === '23503') {
    return res.status(409).json({ success: false, message: 'This action references a record that does not exist or is in use.' });
  }
  // PostgreSQL check_violation
  if (err.code === '23514') {
    return res.status(400).json({ success: false, message: 'Invalid value provided for one or more fields.' });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error. Please try again.' : err.message;
  res.status(statusCode).json({ success: false, message });
}

module.exports = { asyncHandler, AppError, errorHandler };
