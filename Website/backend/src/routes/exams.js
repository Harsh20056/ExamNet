const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validateRequest } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { createExamSchema } = require('../schemas/exam.schemas');
const examService = require('../services/examService');
const { success, created } = require('../utils/responses');

/**
 * POST /api/exams
 * Create a new exam
 * Access: controller only
 */
router.post('/',
  authenticate,
  requireRole(['controller']),
  validateRequest(createExamSchema),
  asyncHandler(async (req, res) => {
    const exam = await examService.createExam(req.body, req.user.uid);
    
    // Calculate total max marks
    const totalMaxMarks = examService.calculateTotalMaxMarks(req.body.questions);
    
    created(res, {
      ...exam,
      totalMaxMarks
    });
  })
);

/**
 * GET /api/exams
 * Get all exams
 * Access: all authenticated users
 */
router.get('/',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const exams = await examService.getAllExams();
    
    // Add total max marks to each exam
    const examsWithTotals = exams.map(exam => ({
      ...exam,
      totalMaxMarks: exam.questions ? 
        examService.calculateTotalMaxMarks(exam.questions) : 0
    }));
    
    success(res, examsWithTotals);
  })
);

/**
 * GET /api/exams/:id
 * Get exam by ID
 * Access: all authenticated users
 */
router.get('/:id',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const exam = await examService.getExamById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        error: 'Exam not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const totalMaxMarks = exam.questions ?
      examService.calculateTotalMaxMarks(exam.questions) : 0;
    
    success(res, {
      ...exam,
      totalMaxMarks
    });
  })
);

module.exports = router;
