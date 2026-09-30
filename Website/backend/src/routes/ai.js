const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validateRequest } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const aiService = require('../services/aiService');
const examService = require('../services/examService');
const sheetService = require('../services/sheetService');
const auditLog = require('../services/auditLog');
const { success, notFound, badRequest, forbidden } = require('../utils/responses');

/**
 * Evaluate request schema
 */
const evaluateRequestSchema = z.object({
  sheetId: z.string().min(1),
  qNo: z.number().int().positive()
}).strict();

/**
 * Decision request schema
 */
const decisionRequestSchema = z.object({
  aiCallId: z.string().min(1),
  decision: z.enum(['accepted', 'overridden']),
  overrideMarks: z.number().min(0).optional(),
  note: z.string().min(1).max(1000)
}).strict().refine(
  data => {
    // If overridden, overrideMarks is required
    if (data.decision === 'overridden') {
      return data.overrideMarks !== undefined;
    }
    return true;
  },
  {
    message: 'overrideMarks is required when decision is overridden',
    path: ['overrideMarks']
  }
);

/**
 * Per-user rate limiter for AI evaluations
 * Limits: 30 evaluations per 15 minutes per user
 */
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window per user
  keyGenerator: (req) => {
    // Use user UID as key for per-user limiting
    return req.user ? req.user.uid : (req.ip || 'anonymous');
  },
  validate: {
    keyGeneratorIpFallback: false
  },
  message: {
    error: 'Too many AI evaluation requests',
    message: 'You have exceeded the rate limit for AI evaluations. Please try again in 15 minutes.',
    limit: 30,
    windowMinutes: 15
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit for controllers (for testing)
  skip: (req) => req.user && req.user.role === 'controller'
});

/**
 * POST /api/ai/evaluate
 * Evaluate answer with AI
 * Access: examiner (assigned sheets), moderator, controller
 */
router.post('/evaluate',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  aiRateLimiter,
  validateRequest(evaluateRequestSchema),
  asyncHandler(async (req, res) => {
    const { sheetId, qNo } = req.body;
    
    // Get sheet
    const sheet = await sheetService.getSheetById(sheetId);
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only evaluate assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return forbidden(res, 'You can only evaluate sheets assigned to you');
    }
    
    // Get exam to access question details
    const exam = await examService.getExamById(sheet.examId);
    if (!exam) {
      return notFound(res, 'Associated exam not found');
    }
    
    // Find question
    const question = exam.questions.find(q => q.qNo === qNo);
    if (!question) {
      return notFound(res, `Question ${qNo} not found in exam`);
    }
    
    // Find page containing this question
    // For now, we'll use the first page or require page mapping
    // In production, you'd have a question-to-page mapping
    if (!sheet.pages || sheet.pages.length === 0) {
      return badRequest(res, 'No pages found in sheet');
    }
    
    // Use first page for demo (in production, map question to specific page)
    const page = sheet.pages[0];
    
    // Call AI service
    const result = await aiService.evaluateAnswer(
      sheetId,
      qNo,
      question,
      page.dataUrl,
      req.user.uid
    );
    
    // Check if AI is unavailable
    if (result.status === 'AI unavailable') {
      return res.status(503).json({
        success: false,
        error: 'AI service unavailable',
        message: result.error || 'AI evaluation service is currently unavailable',
        callId: result.callId,
        retryCount: result.retryCount,
        timestamp: new Date().toISOString()
      });
    }
    
    // Audit log: ai_evaluate (successful evaluation)
    await auditLog.append({
      actor: req.user.uid,
      role: req.user.role,
      action: 'ai_evaluate',
      sheetId,
      before: null,
      after: {
        qNo,
        suggestedMarks: result.suggestedMarks,
        confidence: result.confidence
      },
      metadata: {
        callId: result.callId,
        source: result.source
      }
    });
    
    // Return successful evaluation
    success(res, {
      callId: result.callId,
      suggestedMarks: result.suggestedMarks,
      matched: result.matched,
      missed: result.missed,
      transcription: result.transcription,
      confidence: result.confidence,
      reason: result.reason,
      source: result.source,
      processingTimeMs: result.processingTimeMs,
      maxMarks: question.maxMarks
    });
  })
);

/**
 * POST /api/ai/decision
 * Store AI evaluation decision
 * Access: examiner (assigned sheets), moderator, controller
 */
router.post('/decision',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  validateRequest(decisionRequestSchema),
  asyncHandler(async (req, res) => {
    const { aiCallId, decision, overrideMarks, note } = req.body;
    
    // Store decision
    const result = await aiService.storeAIDecision(
      aiCallId,
      decision,
      overrideMarks,
      note,
      req.user.uid
    );
    
    // Audit log: ai_decision
    await auditLog.append({
      actor: req.user.uid,
      role: req.user.role,
      action: 'ai_decision',
      sheetId: result.sheetId || null,
      before: null,
      after: {
        decision: result.decision.type,
        finalMarks: result.decision.finalMarks
      },
      metadata: {
        aiCallId,
        note: note
      }
    });
    
    success(res, {
      aiCallId: result.id,
      decision: result.decision.type,
      finalMarks: result.decision.finalMarks,
      note: result.decision.note,
      decidedAt: result.decision.decidedAt
    });
  })
);

/**
 * GET /api/ai/calls/:sheetId
 * Get AI calls for a sheet
 * Access: examiner (assigned sheets), moderator, controller
 */
router.get('/calls/:sheetId',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    
    // Get sheet for access control
    const sheet = await sheetService.getSheetById(sheetId);
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only view calls for assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return forbidden(res, 'You can only view AI calls for sheets assigned to you');
    }
    
    // Get AI calls from Firestore
    const { getFirestore } = require('../config/firestore');
    const db = getFirestore();
    
    const snapshot = await db.collection('aiCalls')
      .where('sheetId', '==', sheetId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const calls = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      calls.push({
        id: doc.id,
        qNo: data.qNo,
        status: data.status,
        response: data.response,
        decision: data.decision || null,
        createdAt: data.createdAt,
        processingTimeMs: data.processingTimeMs
      });
    });
    
    success(res, calls);
  })
);

module.exports = router;
