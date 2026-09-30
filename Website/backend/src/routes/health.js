const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint (no authentication required)
 * Returns server status and timestamp
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SAMADHAN X Backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
