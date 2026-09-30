const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { asyncHandler } = require('../middleware/errorHandler');
const { success } = require('../utils/responses');
const analyticsService = require('../services/analytics');

/**
 * GET /api/analytics/me
 * Get current examiner's statistics
 * Access: examiner
 */
router.get('/me',
  authenticate,
  requireRole(['examiner']),
  asyncHandler(async (req, res) => {
    const stats = await analyticsService.getExaminerStatsWithPeerComparison(req.user.uid);
    
    if (!stats) {
      return success(res, {
        message: 'No statistics available yet',
        stats: null
      });
    }
    
    success(res, {
      uid: stats.uid,
      name: stats.name,
      totalSheets: stats.totalSheets,
      completedSheets: stats.completedSheets,
      inProgressSheets: stats.inProgressSheets,
      averageTimePerSheet: stats.averageTimePerSheet,
      averageTimePerSheetMinutes: Math.round(stats.averageTimePerSheet / 60 * 100) / 100,
      sheetsPerDay: Math.round(stats.sheetsPerDay * 100) / 100,
      averageMarks: Math.round(stats.averageMarks * 100) / 100,
      averagePercentage: Math.round(stats.averagePercentage * 100) / 100,
      deviationFromPeerMean: Math.round(stats.deviationFromPeerMean * 100) / 100,
      zScore: Math.round(stats.zScore * 1000) / 1000,
      percentageDeviationFromPeerMean: Math.round(stats.percentageDeviationFromPeerMean * 100) / 100,
      percentageZScore: Math.round(stats.percentageZScore * 1000) / 1000,
      overrideRate: Math.round(stats.overrideRate * 100) / 100,
      moderationChangeRate: Math.round(stats.moderationChangeRate * 100) / 100,
      calibrationScore: Math.round(stats.calibrationScore * 1000) / 1000,
      peerComparison: {
        peerMean: Math.round(stats.peerComparison.peerMean * 100) / 100,
        peerStdDev: Math.round(stats.peerComparison.peerStdDev * 100) / 100,
        peerPercentageMean: Math.round(stats.peerComparison.peerPercentageMean * 100) / 100,
        peerPercentageStdDev: Math.round(stats.peerComparison.peerPercentageStdDev * 100) / 100,
        peerCount: stats.peerComparison.peerCount
      }
    });
  })
);

/**
 * GET /api/analytics/examiners
 * Get statistics for all examiners
 * Access: controller
 */
router.get('/examiners',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const examiners = await analyticsService.getAllExaminersStats();
    
    // Round numbers for cleaner output
    const formattedExaminers = examiners.map(e => ({
      uid: e.uid,
      name: e.name,
      email: e.email,
      totalSheets: e.totalSheets,
      completedSheets: e.completedSheets,
      inProgressSheets: e.inProgressSheets,
      averageTimePerSheet: Math.round(e.averageTimePerSheet),
      averageTimePerSheetMinutes: Math.round(e.averageTimePerSheet / 60 * 100) / 100,
      sheetsPerDay: Math.round(e.sheetsPerDay * 100) / 100,
      averageMarks: Math.round(e.averageMarks * 100) / 100,
      averagePercentage: Math.round(e.averagePercentage * 100) / 100,
      deviationFromPeerMean: Math.round(e.deviationFromPeerMean * 100) / 100,
      zScore: Math.round(e.zScore * 1000) / 1000,
      percentageDeviationFromPeerMean: Math.round(e.percentageDeviationFromPeerMean * 100) / 100,
      percentageZScore: Math.round(e.percentageZScore * 1000) / 1000,
      overrideRate: Math.round(e.overrideRate * 100) / 100,
      moderationChangeRate: Math.round(e.moderationChangeRate * 100) / 100,
      calibrationScore: Math.round(e.calibrationScore * 1000) / 1000
    }));
    
    success(res, formattedExaminers);
  })
);

/**
 * GET /api/analytics/progress
 * Get marking progress statistics
 * Access: controller
 */
router.get('/progress',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const progress = await analyticsService.getProgressStats();
    
    success(res, progress);
  })
);

module.exports = router;
