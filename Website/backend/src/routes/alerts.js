const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { getFirestore } = require('../config/firestore');
const { ANOMALY_TYPES, ALERT_STATUS, ANOMALY_THRESHOLDS } = require('../config/anomalyThresholds');
const { getCurrentTimestamp } = require('../utils/timestamp');
const { success, created, notFound, badRequest } = require('../utils/responses');
const { emitAnomalyAlert } = require('../services/socketEmitters');
const auditLog = require('../services/auditLog');
const { z } = require('zod');

/**
 * Query filters schema
 */
const alertFiltersSchema = z.object({
  type: z.enum([
    ANOMALY_TYPES.A1_UNMARKED_QUESTION,
    ANOMALY_TYPES.A3_MARKS_EXCEED_MAX,
    ANOMALY_TYPES.A4_TOTAL_MISMATCH,
    ANOMALY_TYPES.A5_TIME_ANOMALY,
    ANOMALY_TYPES.P1_PEER_DEVIATION,
    ANOMALY_TYPES.P2_REPEATED_TOTALS,
    ANOMALY_TYPES.P4_CALIBRATION_DRIFT,
    ANOMALY_TYPES.P5_SPEED_DRIFT,
    ANOMALY_TYPES.WINDOW_BLUR,
    ANOMALY_TYPES.SUSPICIOUS_PATTERN,
    ANOMALY_TYPES.IDENTITY_CHECK_FAILED,
    ANOMALY_TYPES.UNVIEWED_PAGE
  ]).optional(),
  severity: z.enum([
    ANOMALY_THRESHOLDS.SEVERITY.HIGH,
    ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
    ANOMALY_THRESHOLDS.SEVERITY.LOW
  ]).optional(),
  status: z.enum([
    ALERT_STATUS.PENDING,
    ALERT_STATUS.RESOLVED,
    ALERT_STATUS.DISMISSED
  ]).optional(),
  sheetId: z.string().optional()
}).strict();

/**
 * Violation report schema (from examiner)
 */
const violationReportSchema = z.object({
  sheetId: z.string().min(1),
  type: z.enum([
    ANOMALY_TYPES.WINDOW_BLUR,
    ANOMALY_TYPES.SUSPICIOUS_PATTERN
  ]),
  message: z.string().min(1).max(500),
  metadata: z.record(z.any()).optional()
}).strict();

/**
 * Resolution schema
 */
const resolveAlertSchema = z.object({
  note: z.string().min(1).max(2000)
}).strict();

/**
 * GET /api/alerts
 * Get alerts with optional filters
 * Access: moderator, controller
 */
router.get('/',
  authenticate,
  requireRole(['moderator', 'controller']),
  validateQuery(alertFiltersSchema),
  asyncHandler(async (req, res) => {
    const db = getFirestore();
    
    let query = db.collection('alerts');
    
    // Apply filters
    if (req.query.type) {
      query = query.where('type', '==', req.query.type);
    }
    
    if (req.query.severity) {
      query = query.where('severity', '==', req.query.severity);
    }
    
    if (req.query.status) {
      query = query.where('status', '==', req.query.status);
    } else {
      // Default to pending if no status filter
      query = query.where('status', '==', ALERT_STATUS.PENDING);
    }
    
    if (req.query.sheetId) {
      query = query.where('sheetId', '==', req.query.sheetId);
    }
    
    // Order by detection time (most recent first)
    query = query.orderBy('detectedAt', 'desc');
    
    const snapshot = await query.get();
    
    const alerts = [];
    snapshot.forEach(doc => {
      alerts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    success(res, alerts);
  })
);

/**
 * POST /api/alerts/violation
 * Report a violation (low severity)
 * Access: examiner (for sheets assigned to them)
 */
router.post('/violation',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  validateRequest(violationReportSchema),
  asyncHandler(async (req, res) => {
    const { sheetId, type, message, metadata } = req.body;
    const db = getFirestore();
    
    // Verify sheet exists
    const sheetDoc = await db.collection('sheets').doc(sheetId).get();
    
    if (!sheetDoc.exists) {
      return notFound(res, 'Sheet not found');
    }
    
    const sheet = sheetDoc.data();
    
    // Examiners can only report for assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only report violations for sheets assigned to you',
        timestamp: getCurrentTimestamp()
      });
    }
    
    // Create alert
    const alert = {
      sheetId,
      type,
      severity: ANOMALY_THRESHOLDS.SEVERITY.LOW,
      message,
      metadata: metadata || {},
      status: ALERT_STATUS.PENDING,
      detectedBy: req.user.uid,
      detectedAt: getCurrentTimestamp(),
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null
    };
    
    const docRef = await db.collection('alerts').add(alert);
    
    // Get sheet to find assigned examiner
    const sheetDoc = await db.collection('sheets').doc(sheetId).get();
    const sheet = sheetDoc.data();
    
    // Emit anomaly alert
    emitAnomalyAlert(req.io, sheet.assignedTo, {
      alertId: docRef.id,
      sheetId,
      anonymizedId: sheet.sheetId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message
    });
    
    created(res, {
      id: docRef.id,
      ...alert
    });
  })
);

/**
 * POST /api/alerts/:id/resolve
 * Resolve an alert
 * Access: moderator, controller
 */
router.post('/:id/resolve',
  authenticate,
  requireRole(['moderator', 'controller']),
  validateRequest(resolveAlertSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { note } = req.body;
    const db = getFirestore();
    
    const alertDoc = await db.collection('alerts').doc(id).get();
    
    if (!alertDoc.exists) {
      return notFound(res, 'Alert not found');
    }
    
    const alert = alertDoc.data();
    
    if (alert.status !== ALERT_STATUS.PENDING) {
      return badRequest(res, `Alert is already ${alert.status}`);
    }
    
    // Update alert
    const updates = {
      status: ALERT_STATUS.RESOLVED,
      resolvedBy: req.user.uid,
      resolvedAt: getCurrentTimestamp(),
      resolutionNote: note
    };
    
    await db.collection('alerts').doc(id).update(updates);
    
    // Audit log: alert_resolve
    await auditLog.append({
      actor: req.user.uid,
      role: req.user.role,
      action: 'alert_resolve',
      sheetId: alert.sheetId,
      before: { status: alert.status },
      after: { status: ALERT_STATUS.RESOLVED },
      metadata: {
        alertId: id,
        alertType: alert.type,
        note: note
      }
    });
    
    success(res, {
      id,
      ...alert,
      ...updates
    });
  })
);

/**
 * GET /api/alerts/summary
 * Get alert summary statistics
 * Access: moderator, controller
 */
router.get('/summary',
  authenticate,
  requireRole(['moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const db = getFirestore();
    
    const snapshot = await db.collection('alerts')
      .where('status', '==', ALERT_STATUS.PENDING)
      .get();
    
    const summary = {
      total: 0,
      bySeverity: {
        high: 0,
        medium: 0,
        low: 0
      },
      byType: {}
    };
    
    snapshot.forEach(doc => {
      const alert = doc.data();
      summary.total++;
      
      if (alert.severity) {
        summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1;
      }
      
      if (alert.type) {
        summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
      }
    });
    
    success(res, summary);
  })
);

module.exports = router;
