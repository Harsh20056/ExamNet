const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validateRequest } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { getFirestore } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');
const { success, notFound, badRequest } = require('../utils/responses');
const sheetService = require('../services/sheetService');
const auditLog = require('../services/auditLog');

/**
 * Identity result schema
 */
const identityResultSchema = z.object({
  sheetId: z.string().min(1),
  result: z.enum(['pass', 'fail']),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().min(1).max(2000).optional()
}).strict();

/**
 * POST /api/identity/result
 * Store identity verification result
 * Access: examiner, moderator, controller
 */
router.post('/result',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  validateRequest(identityResultSchema),
  asyncHandler(async (req, res) => {
    const { sheetId, result, confidence, reason } = req.body;
    
    const db = getFirestore();
    
    // Get sheet
    const sheet = await sheetService.getSheetById(sheetId);
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only verify assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return badRequest(res, 'You can only verify identity for sheets assigned to you');
    }
    
    // Store identity verification result
    const verificationDoc = await db.collection('identityVerifications').add({
      sheetId,
      examId: sheet.examId,
      result,
      confidence: confidence || null,
      reason: reason || null,
      verifiedBy: req.user.uid,
      verifiedAt: getCurrentTimestamp()
    });
    
    // Update sheet with verification status
    await db.collection('sheets').doc(sheetId).update({
      identityVerified: result === 'pass',
      identityVerifiedAt: getCurrentTimestamp(),
      identityVerifiedBy: req.user.uid
    });
    
    // If verification failed, create HIGH severity alert
    if (result === 'fail') {
      const alertDoc = await db.collection('alerts').add({
        sheetId,
        examId: sheet.examId,
        type: 'identity_check_failed',
        severity: 'high',
        status: 'open',
        message: 'Identity verification failed',
        description: reason || 'Face does not match reference descriptor',
        metadata: {
          confidence: confidence || null,
          verifiedBy: req.user.uid,
          verificationId: verificationDoc.id
        },
        createdAt: getCurrentTimestamp()
      });
      
      // Emit identity_check_failed event to controller room
      if (req.io) {
        req.io.to('controller').emit('identity_check_failed', {
          id: alertDoc.id,
          sheetId,
          sheetAnonymousId: sheet.sheetId,
          examId: sheet.examId,
          result,
          confidence: confidence || null,
          reason: reason || 'Face does not match reference descriptor',
          verifiedBy: req.user.uid,
          timestamp: getCurrentTimestamp()
        });
      }
    }
    
    // Audit log: identity_result
    await auditLog.append({
      actor: req.user.uid,
      role: req.user.role,
      action: 'identity_result',
      sheetId,
      before: null,
      after: {
        result,
        confidence: confidence || null
      },
      metadata: {
        reason: reason || null,
        verificationId: verificationDoc.id
      }
    });
    
    success(res, {
      sheetId: sheet.sheetId,
      result,
      confidence: confidence || null,
      verifiedAt: getCurrentTimestamp(),
      alert: result === 'fail' ? 'Identity check failure alert created' : null
    });
  })
);

/**
 * GET /api/identity/verifications/:sheetId
 * Get identity verification history for a sheet
 * Access: examiner (assigned), moderator, controller
 */
router.get('/verifications/:sheetId',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    
    const db = getFirestore();
    
    // Get sheet for access control
    const sheet = await sheetService.getSheetById(sheetId);
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only view verifications for assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return badRequest(res, 'You can only view verifications for sheets assigned to you');
    }
    
    // Get verification history
    const snapshot = await db.collection('identityVerifications')
      .where('sheetId', '==', sheetId)
      .orderBy('verifiedAt', 'desc')
      .get();
    
    const verifications = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      verifications.push({
        id: doc.id,
        result: data.result,
        confidence: data.confidence,
        reason: data.reason,
        verifiedBy: data.verifiedBy,
        verifiedAt: data.verifiedAt
      });
    });
    
    success(res, {
      sheetId: sheet.sheetId,
      currentStatus: {
        verified: sheet.identityVerified || false,
        verifiedAt: sheet.identityVerifiedAt || null,
        verifiedBy: sheet.identityVerifiedBy || null
      },
      history: verifications
    });
  })
);

module.exports = router;
