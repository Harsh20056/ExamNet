/**
 * Centralized Error Handling Middleware
 * Catches errors from async route handlers and provides consistent error responses
 */

function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || err.name || 'INTERNAL_ERROR';

  console.error('[Error Handler]', {
    error: message,
    code: code,
    status: status,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Always return clean JSON with error and code. Never expose stack traces in production.
  res.status(status).json({
    error: message,
    code: code,
    ...(!isProduction && { stack: err.stack })
  });
}

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch promise rejections
 * 
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found Handler
 * Place this after all routes to catch unmatched requests
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
};
