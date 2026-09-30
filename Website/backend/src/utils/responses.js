/**
 * Standard API Response Utilities
 * Provides consistent response formats across all endpoints
 */

const { getCurrentTimestamp } = require('./timestamp');

/**
 * Success response with data
 * @param {object} res - Express response object
 * @param {any} data - Data to send
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    timestamp: getCurrentTimestamp()
  });
}

/**
 * Created response (201)
 * @param {object} res - Express response object
 * @param {any} data - Created resource data
 */
function created(res, data) {
  return success(res, data, 201);
}

/**
 * No content response (204)
 * @param {object} res - Express response object
 */
function noContent(res) {
  return res.status(204).send();
}

/**
 * Error response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {object} details - Additional error details
 */
function error(res, message, statusCode = 400, details = null) {
  const response = {
    success: false,
    error: message,
    timestamp: getCurrentTimestamp()
  };
  
  if (details) {
    response.details = details;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Bad request response (400)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {object} details - Validation details
 */
function badRequest(res, message = 'Bad request', details = null) {
  return error(res, message, 400, details);
}

/**
 * Unauthorized response (401)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401);
}

/**
 * Forbidden response (403)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
function forbidden(res, message = 'Forbidden') {
  return error(res, message, 403);
}

/**
 * Not found response (404)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
function notFound(res, message = 'Resource not found') {
  return error(res, message, 404);
}

/**
 * Conflict response (409)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
function conflict(res, message = 'Conflict') {
  return error(res, message, 409);
}

/**
 * Internal server error response (500)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
function serverError(res, message = 'Internal server error') {
  return error(res, message, 500);
}

/**
 * Paginated response
 * @param {object} res - Express response object
 * @param {array} items - Array of items
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 */
function paginated(res, items, total, page, limit) {
  return success(res, {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  });
}

module.exports = {
  success,
  created,
  noContent,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  paginated
};
