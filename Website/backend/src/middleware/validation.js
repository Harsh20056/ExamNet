const { z } = require('zod');

/**
 * Zod Validation Middleware Factory
 * Validates request body against a Zod schema
 * Rejects unknown fields by default (strict mode)
 * 
 * @param {z.ZodSchema} schema - Zod schema for validation
 * @returns {Function} Express middleware
 */
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate request body
      // .strict() ensures unknown fields are rejected
      const validated = schema.parse(req.body);
      
      // Replace req.body with validated data
      req.body = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format Zod errors into user-friendly messages
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Unexpected error
      console.error('[Validation] Unexpected error:', error);
      return res.status(500).json({
        error: 'Internal server error during validation'
      });
    }
  };
}

/**
 * Validates query parameters
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: 'Query validation failed',
          details: errors
        });
      }

      console.error('[Validation] Unexpected error:', error);
      return res.status(500).json({
        error: 'Internal server error during validation'
      });
    }
  };
}

/**
 * Validates route parameters
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: 'Parameter validation failed',
          details: errors
        });
      }

      console.error('[Validation] Unexpected error:', error);
      return res.status(500).json({
        error: 'Internal server error during validation'
      });
    }
  };
}

module.exports = {
  validateRequest,
  validateQuery,
  validateParams
};
