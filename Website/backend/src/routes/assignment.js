const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validateRequest } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const assignmentService = require('../services/assignmentService');
const { success, badRequest, notFound } = require('../utils/responses');

/**
 * Assign sheets schema
 */
const assignSheetsSchema = z.object({
  examId: z.string().min(1),
  sheetIds: z.array(z.string()).optional() // If not provided, assigns all unassigned sheets
}).strict();

/**
 * Question-wise assignment schema
 */
const questionWiseSchema = z.object({
  sheetId: z.string().min(1),
  questionAssignments: z.record(z.string(), z.string()) // qNo -> examiner UID
}).strict();

/**
 * POST /api/sheets/assign
 * Assign sheets to examiners using least-loaded strategy
 * Optionally injects calibration sheets
 * 
 * Access: controller only
 */
router.post('/assign',
  authenticate,
  requireRole(['controller']),
  validateRequest(assignSheetsSchema),
  asyncHandler(async (req, res) => {
    const { examId, sheetIds } = req.body;
    
    const result = await assignmentService.assignSheets(
      examId,
      sheetIds,
      req.user.uid,
      req.user.role,
      req.io
    );
    
    success(res, {
      message: `Assigned ${result.assigned} sheets`,
      ...result
    });
  })
);

/**
 * POST /api/sheets/assign/question-wise
 * Create question-wise sub-assignments for a sheet
 * 
 * Access: controller only
 */
router.post('/assign/question-wise',
  authenticate,
  requireRole(['controller']),
  validateRequest(questionWiseSchema),
  asyncHandler(async (req, res) => {
    const { sheetId, questionAssignments } = req.body;
    
    const result = await assignmentService.createQuestionWiseAssignments(
      sheetId,
      questionAssignments,
      req.user.uid,
      req.user.role
    );
    
    success(res, {
      message: `Created ${result.subAssignments} sub-assignments`,
      ...result
    });
  })
);

/**
 * GET /api/sheets/:sheetId/sub-assignments
 * Get sub-assignments for a sheet
 * 
 * Access: controller, moderator
 */
router.get('/:sheetId/sub-assignments',
  authenticate,
  requireRole(['controller', 'moderator']),
  asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    
    const subAssignments = await assignmentService.getSubAssignments(sheetId);
    
    success(res, {
      sheetId,
      count: subAssignments.length,
      subAssignments
    });
  })
);

/**
 * POST /api/sheets/:sheetId/merge
 * Merge sub-assignments and calculate final total
 * 
 * Access: controller only
 */
router.post('/:sheetId/merge',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    
    const result = await assignmentService.mergeSubAssignments(sheetId);
    
    if (!result.merged) {
      return badRequest(res, result.message, {
        pendingCount: result.pendingCount,
        pending: result.pending
      });
    }
    
    success(res, {
      message: 'Sub-assignments merged successfully',
      ...result
    });
  })
);

/**
 * GET /api/workload/:examId
 * Get examiner workload for an exam
 * 
 * Access: controller only
 */
router.get('/workload/:examId',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const { subject } = req.query;
    
    const workload = await assignmentService.getExaminerWorkload(examId, subject);
    
    success(res, {
      examId,
      subject: subject || 'all',
      workload,
      totalAssigned: Object.values(workload).reduce((sum, count) => sum + count, 0)
    });
  })
);

module.exports = router;
