const express = require('express');
const router = express.Router();
const multer = require('multer');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validateRequest, validateQuery, validateParams } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  uploadSheetMetadataSchema, 
  statusFilterSchema, 
  saveMarksSchema,
  qNoParamSchema 
} = require('../schemas/sheet.schemas');
const sheetService = require('../services/sheetService');
const examService = require('../services/examService');
const { success, created, badRequest, forbidden, notFound } = require('../utils/responses');
const { emitSheetUpdated, emitAnomalyAlert, emitModerationNeeded } = require('../services/socketEmitters');

// Configure multer for file uploads (store in memory for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Max 50 pages per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * POST /api/sheets/upload
 * Upload answer sheet pages
 * Access: controller only
 */
router.post('/upload',
  authenticate,
  requireRole(['controller']),
  upload.array('pages', 50), // Accept up to 50 page images
  asyncHandler(async (req, res) => {
    // Validate metadata
    const validation = uploadSheetMetadataSchema.safeParse(req.body);
    if (!validation.success) {
      return badRequest(res, 'Invalid metadata', validation.error.errors);
    }
    
    const { rollNo, studentName, examId, pageUrls } = validation.data;
    
    // Check if either files were uploaded or pageUrls provided
    const hasFiles = req.files && req.files.length > 0;
    const hasUrls = Array.isArray(pageUrls) && pageUrls.length > 0;

    if (!hasFiles && !hasUrls) {
      return badRequest(res, 'No page images or URLs provided');
    }
    
    // Verify exam exists
    const exam = await examService.getExamById(examId);
    if (!exam) {
      return notFound(res, 'Exam not found');
    }
    
    // Convert uploaded files to base64 data URLs or map provided URLs
    let pages = [];
    if (hasFiles) {
      pages = req.files.map((file, index) => ({
        pageNumber: index + 1,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        dataUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
      }));
    } else if (hasUrls) {
      pages = pageUrls.map((url, index) => ({
        pageNumber: index + 1,
        fileName: `page_${index + 1}.jpg`,
        mimeType: 'image/jpeg',
        size: 0,
        dataUrl: url,
        url: url
      }));
    }
    
    // Create sheet with anonymized ID
    const sheet = await sheetService.createSheet({
      rollNo,
      studentName,
      examId,
      pages
    }, req.user.uid, req.user.role);
    
    // Set max marks from exam
    const totalMaxMarks = examService.calculateTotalMaxMarks(exam.questions);
    
    const db = require('../config/firestore').getFirestore();
    await db.collection('sheets').doc(sheet.id).update({
      maxMarks: totalMaxMarks
    });
    
    created(res, {
      id: sheet.id,
      sheetId: sheet.sheetId,
      examId: sheet.examId,
      status: sheet.status,
      pageCount: pages.length,
      uploadedAt: sheet.uploadedAt,
      maxMarks: totalMaxMarks
    });
  })
);

/**
 * GET /api/sheets
 * Get sheets with optional filters
 * Access: controller only
 */
router.get('/',
  authenticate,
  requireRole(['controller']),
  validateQuery(statusFilterSchema),
  asyncHandler(async (req, res) => {
    const sheets = await sheetService.getSheets(req.query);
    
    // Return sheets without identity information
    const sanitizedSheets = sheets.map(sheet => ({
      id: sheet.id,
      sheetId: sheet.sheetId,
      examId: sheet.examId,
      status: sheet.status,
      assignedTo: sheet.assignedTo,
      uploadedAt: sheet.uploadedAt,
      startedAt: sheet.startedAt,
      completedAt: sheet.completedAt,
      totalMarks: sheet.totalMarks,
      maxMarks: sheet.maxMarks,
      pageCount: sheet.pages ? sheet.pages.length : 0
    }));
    
    success(res, sanitizedSheets);
  })
);

/**
 * GET /api/sheets/mine
 * Get sheets assigned to current examiner
 * Access: examiner only
 */
router.get('/mine',
  authenticate,
  requireRole(['examiner']),
  asyncHandler(async (req, res) => {
    const sheets = await sheetService.getSheets({
      assignedTo: req.user.uid
    });
    
    // Return sheets without identity information
    const sanitizedSheets = sheets.map(sheet => ({
      id: sheet.id,
      sheetId: sheet.sheetId,
      examId: sheet.examId,
      status: sheet.status,
      startedAt: sheet.startedAt,
      completedAt: sheet.completedAt,
      totalMarks: sheet.totalMarks,
      maxMarks: sheet.maxMarks,
      pageCount: sheet.pages ? sheet.pages.length : 0
    }));
    
    success(res, sanitizedSheets);
  })
);

/**
 * GET /api/sheets/:id
 * Get sheet details
 * Access: examiner (if assigned), moderator, controller
 */
router.get('/:id',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const sheet = await sheetService.getSheetById(req.params.id);
    
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only see assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return forbidden(res, 'You can only access sheets assigned to you');
    }
    
    // Get exam definition
    const exam = await examService.getExamById(sheet.examId);
    if (!exam) {
      return notFound(res, 'Associated exam not found');
    }
    
    // Get current marks
    const marks = await sheetService.getSheetMarks(req.params.id);
    
    // Return sheet with exam and marks, but NEVER identity
    success(res, {
      id: sheet.id,
      sheetId: sheet.sheetId,
      examId: sheet.examId,
      status: sheet.status,
      assignedTo: sheet.assignedTo,
      pages: sheet.pages,
      startedAt: sheet.startedAt,
      completedAt: sheet.completedAt,
      totalMarks: sheet.totalMarks,
      maxMarks: sheet.maxMarks,
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        questions: exam.questions
      },
      marks: marks.map(m => ({
        qNo: m.qNo,
        marks: m.marks,
        comment: m.comment,
        timeSpentSec: m.timeSpentSec,
        markedAt: m.markedAt
      }))
    });
  })
);

/**
 * POST /api/sheets/:id/start
 * Start marking a sheet
 * Access: examiner (if assigned), moderator, controller
 */
router.post('/:id/start',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const sheet = await sheetService.getSheetById(req.params.id);
    
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only start assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return forbidden(res, 'You can only start sheets assigned to you');
    }
    
    // Check if already in progress or completed
    if (sheet.status !== 'uploaded') {
      return badRequest(res, `Sheet is already ${sheet.status}`);
    }
    
    const updatedSheet = await sheetService.startMarking(req.params.id, req.user.uid, req.user.role);
    
    // Emit sheet_updated event
    emitSheetUpdated(req.io, {
      sheetId: updatedSheet.id,
      anonymizedId: updatedSheet.sheetId,
      status: updatedSheet.status,
      assignedTo: updatedSheet.assignedTo
    });
    
    success(res, {
      id: updatedSheet.id,
      sheetId: updatedSheet.sheetId,
      status: updatedSheet.status,
      startedAt: updatedSheet.startedAt
    });
  })
);

/**
 * PUT /api/sheets/:id/marks/:qNo
 * Save marks for a specific question (with quick anomaly check)
 * Access: examiner (if assigned), moderator, controller
 */
router.put('/:id/marks/:qNo',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  validateParams(qNoParamSchema),
  validateRequest(saveMarksSchema),
  asyncHandler(async (req, res) => {
    const { id: sheetId } = req.params;
    const { qNo } = req.params;
    
    const sheet = await sheetService.getSheetById(sheetId);
    
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only mark assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return forbidden(res, 'You can only mark sheets assigned to you');
    }
    
    // Get exam to validate question and max marks
    const exam = await examService.getExamById(sheet.examId);
    if (!exam) {
      return notFound(res, 'Associated exam not found');
    }
    
    const question = exam.questions.find(q => q.qNo === Number(qNo) || String(q.qNo) === String(qNo));
    if (!question) {
      return notFound(res, `Question ${qNo} not found in exam`);
    }
    
    // Quick anomaly check (A3: marks exceed max)
    const anomalyEngine = require('../services/anomalyEngine');
    const quickAlerts = anomalyEngine.quickCheck({ qNo, marks: req.body.marks }, question);
    
    // Store any alerts found
    if (quickAlerts.length > 0) {
      await anomalyEngine.storeAlerts(sheetId, quickAlerts, req.user.uid, req.user.role);
    }
    
    // Validate marks <= question max marks (reject if exceeded)
    if (req.body.marks > question.maxMarks) {
      return badRequest(res, 
        `Marks (${req.body.marks}) exceed maximum for question ${qNo} (${question.maxMarks})`
      );
    }
    
    // Save marks
    const markEntry = await sheetService.saveQuestionMarks(sheetId, qNo, {
      ...req.body,
      markedBy: req.user.uid,
      markerRole: req.user.role
    });
    
    // Recalculate total on server
    const newTotal = await sheetService.recalculateTotalMarks(sheetId);
    
    // Emit sheet_updated event
    emitSheetUpdated(req.io, {
      sheetId: sheet.id,
      anonymizedId: sheet.sheetId,
      questionNo: qNo,
      marks: req.body.marks,
      totalMarks: newTotal
    });
    
    // Emit anomaly alerts if any
    if (quickAlerts.length > 0) {
      emitAnomalyAlert(req.io, sheet.assignedTo, {
        sheetId: sheet.id,
        anonymizedId: sheet.sheetId,
        alerts: quickAlerts
      });
    }
    
    success(res, {
      qNo: markEntry.qNo,
      marks: markEntry.marks,
      comment: markEntry.comment,
      totalMarks: newTotal,
      maxMarks: sheet.maxMarks,
      markedAt: markEntry.markedAt,
      alerts: quickAlerts.length > 0 ? quickAlerts : undefined
    });
  })
);

/**
 * PUT /api/sheets/:id/marks
 * Save batch marks for questions on a sheet
 * Access: examiner (if assigned), moderator, controller
 */
router.put('/:id/marks',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const { id: sheetId } = req.params;
    const sheet = await sheetService.getSheetById(sheetId);
    if (!sheet) return notFound(res, 'Sheet not found');
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return forbidden(res, 'You can only mark sheets assigned to you');
    }
    const exam = await examService.getExamById(sheet.examId);
    if (!exam) return notFound(res, 'Associated exam not found');

    const marksArray = Array.isArray(req.body.marks) 
      ? req.body.marks 
      : (Array.isArray(req.body) ? req.body : []);

    for (const m of marksArray) {
      const qNum = Number(m.qNo);
      const qMarks = Number(m.marks);
      if (!isNaN(qNum) && !isNaN(qMarks)) {
        await sheetService.saveQuestionMarks(sheetId, qNum, {
          marks: qMarks,
          comment: m.comment || '',
          timeSpentSec: m.timeSpentSec || 0,
          markedBy: req.user.uid,
          markerRole: req.user.role
        });
      }
    }

    const newTotal = await sheetService.recalculateTotalMarks(sheetId);
    emitSheetUpdated(req.io, {
      sheetId: sheet.id,
      anonymizedId: sheet.sheetId,
      totalMarks: newTotal,
      assignedTo: sheet.assignedTo
    });

    success(res, {
      sheetId: sheet.id,
      totalMarks: newTotal,
      maxMarks: sheet.maxMarks,
      updatedMarksCount: marksArray.length
    });
  })
);

router.post('/:id/marks',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res, next) => {
    // Forward to PUT handler
    req.method = 'PUT';
    router.handle(req, res, next);
  })
);

/**
 * POST /api/sheets/:id/submit
 * Submit sheet as evaluated (with full anomaly check)
 * Access: examiner (if assigned), moderator, controller
 */
router.post('/:id/submit',
  authenticate,
  requireRole(['examiner', 'moderator', 'controller']),
  asyncHandler(async (req, res) => {
    const sheet = await sheetService.getSheetById(req.params.id);
    
    if (!sheet) {
      return notFound(res, 'Sheet not found');
    }
    
    // Access control: examiner can only submit assigned sheets
    if (req.user.role === 'examiner' && sheet.assignedTo !== req.user.uid) {
      return forbidden(res, 'You can only submit sheets assigned to you');
    }
    
    // Check if sheet is in progress
    if (sheet.status !== 'in_progress') {
      return badRequest(res, `Cannot submit sheet with status: ${sheet.status}`);
    }
    
    // Get exam for anomaly detection
    const exam = await examService.getExamById(sheet.examId);
    if (!exam) {
      return notFound(res, 'Associated exam not found');
    }
    
    // Submit with anomaly detection
    const result = await sheetService.submitSheet(req.params.id, exam, req.user.uid, req.user.role);
    
    // Emit sheet_updated event
    emitSheetUpdated(req.io, {
      sheetId: result.sheet.id,
      anonymizedId: result.sheet.sheetId,
      status: result.sheet.status,
      totalMarks: result.sheet.totalMarks,
      flagged: result.hasCriticalAlerts
    });
    
    // Emit anomaly alerts if any
    if (result.alerts.length > 0) {
      emitAnomalyAlert(req.io, sheet.assignedTo, {
        sheetId: result.sheet.id,
        anonymizedId: result.sheet.sheetId,
        alerts: result.alerts,
        severity: result.hasCriticalAlerts ? 'high' : 'medium'
      });
    }
    
    // Emit moderation_needed if flagged
    if (result.hasCriticalAlerts) {
      emitModerationNeeded(req.io, {
        sheetId: result.sheet.id,
        anonymizedId: result.sheet.sheetId,
        alertCount: result.alerts.length,
        examId: result.sheet.examId
      });
    }
    
    success(res, {
      id: result.sheet.id,
      sheetId: result.sheet.sheetId,
      status: result.sheet.status,
      totalMarks: result.sheet.totalMarks,
      maxMarks: result.sheet.maxMarks,
      completedAt: result.sheet.completedAt,
      alerts: result.alerts,
      flagged: result.hasCriticalAlerts
    });
  })
);

module.exports = router;
