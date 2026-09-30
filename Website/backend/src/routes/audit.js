const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { asyncHandler } = require('../middleware/errorHandler');
const { success } = require('../utils/responses');
const auditLog = require('../services/auditLog');

/**
 * GET /api/audit
 * Search audit log
 * Access: controller only
 */
router.get('/',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const filters = {
      actor: req.query.actor,
      action: req.query.action,
      sheetId: req.query.sheetId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    const entries = await auditLog.search(filters);
    
    success(res, {
      entries,
      count: entries.length,
      filters
    });
  })
);

/**
 * GET /api/audit/verify
 * Verify audit log integrity
 * Access: controller only
 */
router.get('/verify',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const result = await auditLog.verify();
    
    success(res, result);
  })
);

/**
 * GET /api/audit/statistics
 * Get audit log statistics
 * Access: controller only
 */
router.get('/statistics',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const stats = await auditLog.getStatistics();
    
    success(res, stats);
  })
);

module.exports = router;
