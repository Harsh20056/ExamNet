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
const examService = require('../services/examService');
const { emitSheetUpdated } = require('../services/socketEmitters');
const auditLog = require('../services/auditLog');

/**
 * Moderation action schema
 */
const moderationActionSchema = z.object({
  action: z.enum(['approve', 'adjust', 'sendback']),
  reason: z.string().min(1).max(2000),
  adjustedMarks: z.array(z.object({
    qNo: z.number().int().positive(),
    marks: z.number().min(0),
    comment: z.string().max(2000).optional()
  })).optional()
}).strict().refine(
  data => {
    // If adjust action, adjustedMarks is required
    if (data.action === 'adjust') {
      return data.adjustedMarks !== undefined && data.adjustedMarks.length > 0;
    }
    return true;
  },
  {
    message: 'adjustedMarks is required when action is adjust',
    path: ['adjustedMarks']
  }
);

/**
 * GET /api/moderation/queue
 * Get flagged sheets for moderation
 * Access: moderator, controller
 */
router.get('/queue',
  authenticate,
  requireRole(['moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const db = getFirestore();
    
    // Get all flagged sheets
    const sheetsSnapshot = await db.collection('sheets')
      .where('status', '==', 'flagged')
      .orderBy('completedAt', 'desc')
      .get();
    
    const queue = [];
    
    for (const doc of sheetsSnapshot.docs) {
      const sheetData = { id: doc.id, ...doc.data() };
      
      // Get exam for question details
      const exam = await examService.getExamById(sheetData.examId);
      
      // Get marks for this sheet
      const marksSnapshot = await db.collection('marks')
        .where('sheetId', '==', doc.id)
        .get();
      
      const marks = [];
      marksSnapshot.forEach(markDoc => {
        marks.push(markDoc.data());
      });
      
      // Get alerts for this sheet (HIGH severity only)
      const alertsSnapshot = await db.collection('alerts')
        .where('sheetId', '==', doc.id)
        .where('severity', '==', 'high')
        .where('status', '==', 'open')
        .get();
      
      const alerts = [];
      alertsSnapshot.forEach(alertDoc => {
        const alertData = alertDoc.data();
        alerts.push({
          id: alertDoc.id,
          type: alertData.type,
          severity: alertData.severity,
          message: alertData.message,
          metadata: alertData.metadata,
          createdAt: alertData.createdAt
        });
      });
      
      queue.push({
        id: sheetData.id,
        sheetId: sheetData.sheetId,
        examId: sheetData.examId,
        examTitle: exam ? exam.title : 'Unknown',
        assignedTo: sheetData.assignedTo,
        totalMarks: sheetData.totalMarks,
        maxMarks: sheetData.maxMarks,
        completedAt: sheetData.completedAt,
        marks,
        alerts,
        alertCount: alerts.length
      });
    }
    
    success(res, queue);
  })
);

/**
 * POST /api/moderation/:sheetId
 * Perform moderation action on sheet
 * Access: moderator, controller
 */
router.post('/:sheetId',
  authenticate,
  requireRole(['moderator', 'controller']),
  validateRequest(moderationActionSchema),
  asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    const { action, reason, adjustedMarks } = req.body;
    
    const db = getFirestore();
    
    // Get sheet
    const sheet = await sheetService.getSheetById(sheetId);
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Verify sheet is flagged
    if (sheet.status !== 'flagged') {
      return badRequest(res, 'Sheet is not flagged for moderation');
    }
    
    // Get exam for validation
    const exam = await examService.getExamById(sheet.examId);
    if (!exam) {
      return notFound(res, 'Associated exam not found');
    }
    
    // Get current marks
    const marksSnapshot = await db.collection('marks')
      .where('sheetId', '==', sheetId)
      .get();
    
    const beforeMarks = [];
    marksSnapshot.forEach(markDoc => {
      beforeMarks.push(markDoc.data());
    });
    
    // Prepare after marks and updates based on action
    let afterMarks = [...beforeMarks];
    let newStatus = 'evaluated';
    let updates = {};
    
    if (action === 'adjust') {
      // Validate adjusted marks
      for (const adjustment of adjustedMarks) {
        const question = exam.questions.find(q => q.qNo === adjustment.qNo);
        if (!question) {
          return badRequest(res, `Question ${adjustment.qNo} not found in exam`);
        }
        if (adjustment.marks > question.maxMarks) {
          return badRequest(res, `Marks for Q${adjustment.qNo} exceed maximum (${question.maxMarks})`);
        }
      }
      
      // Apply adjustments
      for (const adjustment of adjustedMarks) {
        const existingMarkIndex = afterMarks.findIndex(m => m.qNo === adjustment.qNo);
        
        if (existingMarkIndex >= 0) {
          // Update existing mark
          afterMarks[existingMarkIndex] = {
            ...afterMarks[existingMarkIndex],
            marks: adjustment.marks,
            comment: adjustment.comment || afterMarks[existingMarkIndex].comment,
            adjustedBy: req.user.uid,
            adjustedAt: getCurrentTimestamp()
          };
          
          // Update in Firestore
          const markDoc = marksSnapshot.docs.find(doc => doc.data().qNo === adjustment.qNo);
          if (markDoc) {
            await db.collection('marks').doc(markDoc.id).update({
              marks: adjustment.marks,
              comment: adjustment.comment || afterMarks[existingMarkIndex].comment,
              adjustedBy: req.user.uid,
              adjustedAt: getCurrentTimestamp()
            });
          }
        }
      }
      
      // Recalculate total
      const newTotal = afterMarks.reduce((sum, mark) => sum + mark.marks, 0);
      
      updates = {
        status: 'final',
        totalMarks: newTotal,
        moderatedAt: getCurrentTimestamp(),
        moderatedBy: req.user.uid
      };
      
      newStatus = 'final';
      
    } else if (action === 'approve') {
      // Approve without changes
      updates = {
        status: 'final',
        moderatedAt: getCurrentTimestamp(),
        moderatedBy: req.user.uid
      };
      
      newStatus = 'final';
      
    } else if (action === 'sendback') {
      // Send back to examiner
      updates = {
        status: 'in_progress',
        moderatedAt: getCurrentTimestamp(),
        moderatedBy: req.user.uid
      };
      
      newStatus = 'in_progress';
    }
    
    // Update sheet
    await db.collection('sheets').doc(sheetId).update(updates);
    
    // Store moderation record
    await db.collection('moderation').add({
      sheetId: sheetId,
      examId: sheet.examId,
      action,
      reason,
      beforeMarks,
      afterMarks: action === 'adjust' ? afterMarks : beforeMarks,
      beforeTotal: sheet.totalMarks,
      afterTotal: updates.totalMarks || sheet.totalMarks,
      moderatedBy: req.user.uid,
      moderatedAt: getCurrentTimestamp()
    });
    
    // Resolve all HIGH severity alerts for this sheet if approved/adjusted
    if (action === 'approve' || action === 'adjust') {
      const alertsSnapshot = await db.collection('alerts')
        .where('sheetId', '==', sheetId)
        .where('severity', '==', 'high')
        .where('status', '==', 'open')
        .get();
      
      const batch = db.batch();
      alertsSnapshot.forEach(alertDoc => {
        batch.update(alertDoc.ref, {
          status: 'resolved',
          resolvedBy: req.user.uid,
          resolvedAt: getCurrentTimestamp(),
          note: `Auto-resolved by moderation action: ${action}`
        });
      });
      await batch.commit();
    }
    
    // Get updated sheet for response
    const updatedSheet = await sheetService.getSheetById(sheetId);
    
    // Audit log: moderation
    await auditLog.append({
      actor: req.user.uid,
      role: req.user.role,
      action: 'moderation',
      sheetId,
      before: {
        status: sheet.status,
        totalMarks: sheet.totalMarks,
        marks: beforeMarks
      },
      after: {
        status: newStatus,
        totalMarks: updates.totalMarks || sheet.totalMarks,
        marks: afterMarks
      },
      metadata: {
        moderationAction: action,
        reason: reason
      }
    });
    
    // Emit socket events
    if (req.io) {
      emitSheetUpdated(req.io, updatedSheet);
      
      // Emit dashboard tick for stats update
      req.io.to('controller').emit('dashboard_tick', {
        timestamp: getCurrentTimestamp(),
        trigger: 'moderation_action'
      });
    }
    
    success(res, {
      sheetId: updatedSheet.sheetId,
      action,
      status: newStatus,
      totalMarks: updatedSheet.totalMarks,
      maxMarks: updatedSheet.maxMarks,
      moderatedAt: updates.moderatedAt
    });
  })
);

module.exports = router;
