const express = require('express');
const router = express.Router();
const { stringify } = require('csv-stringify/sync');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { asyncHandler } = require('../middleware/errorHandler');
const { getFirestore } = require('../config/firestore');
const examService = require('../services/examService');
const { badRequest } = require('../utils/responses');

/**
 * GET /api/export/results
 * Export final sheets as CSV
 * 
 * Query parameters:
 * - examId: Filter by exam ID (optional)
 * - subject: Filter by subject (optional)
 * 
 * Access: controller only
 */
router.get('/results',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const db = getFirestore();
    const { examId, subject } = req.query;
    
    // Build query for final sheets
    let query = db.collection('sheets').where('status', '==', 'final');
    
    if (examId) {
      query = query.where('examId', '==', examId);
    }
    
    const sheetsSnapshot = await query.get();
    
    if (sheetsSnapshot.empty) {
      return badRequest(res, 'No final sheets found');
    }
    
    // Prepare CSV data
    const rows = [];
    
    // Add header row
    rows.push([
      'Sheet ID',
      'Roll No',
      'Student Name',
      'Exam Title',
      'Subject',
      'Total Marks',
      'Max Marks',
      'Percentage',
      'Completed At',
      'Moderated By',
      'Moderated At',
      'Is Calibration'
    ]);
    
    // Process each sheet
    for (const doc of sheetsSnapshot.docs) {
      const sheet = doc.data();
      
      // Get exam details
      const exam = await examService.getExamById(sheet.examId);
      
      // Skip if subject filter is provided and doesn't match
      if (subject && exam && exam.subject !== subject) {
        continue;
      }
      
      // Get identity mapping (rollNo, studentName)
      const identitySnapshot = await db.collection('identityMap')
        .where('sheetId', '==', sheet.sheetId)
        .limit(1)
        .get();
      
      let rollNo = 'N/A';
      let studentName = 'N/A';
      
      if (!identitySnapshot.empty) {
        const identity = identitySnapshot.docs[0].data();
        rollNo = identity.rollNo || 'N/A';
        studentName = identity.studentName || 'N/A';
      }
      
      // Calculate percentage
      const percentage = sheet.maxMarks > 0 
        ? ((sheet.totalMarks / sheet.maxMarks) * 100).toFixed(2)
        : '0.00';
      
      // Add data row
      rows.push([
        sheet.sheetId,
        rollNo,
        studentName,
        exam ? exam.title : 'Unknown Exam',
        exam ? exam.subject : 'Unknown',
        sheet.totalMarks || 0,
        sheet.maxMarks || 0,
        percentage,
        sheet.completedAt || 'N/A',
        sheet.moderatedBy || 'N/A',
        sheet.moderatedAt || 'N/A',
        sheet.isCalibration ? 'Yes' : 'No'
      ]);
    }
    
    // Generate CSV
    const csv = stringify(rows);
    
    // Set headers for CSV download
    const filename = examId 
      ? `results_${examId}_${Date.now()}.csv`
      : `results_all_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csv);
  })
);

/**
 * GET /api/export/marks
 * Export detailed marks (question-wise) as CSV
 * 
 * Query parameters:
 * - examId: Exam ID (required)
 * 
 * Access: controller only
 */
router.get('/marks',
  authenticate,
  requireRole(['controller']),
  asyncHandler(async (req, res) => {
    const db = getFirestore();
    const { examId } = req.query;
    
    if (!examId) {
      return badRequest(res, 'examId is required');
    }
    
    // Get exam
    const exam = await examService.getExamById(examId);
    if (!exam) {
      return badRequest(res, 'Exam not found');
    }
    
    // Get all final sheets for this exam
    const sheetsSnapshot = await db.collection('sheets')
      .where('examId', '==', examId)
      .where('status', '==', 'final')
      .get();
    
    if (sheetsSnapshot.empty) {
      return badRequest(res, 'No final sheets found for this exam');
    }
    
    // Prepare CSV data
    const rows = [];
    
    // Build header row dynamically based on questions
    const headerRow = [
      'Sheet ID',
      'Roll No',
      'Student Name'
    ];
    
    // Add column for each question
    exam.questions.forEach(q => {
      headerRow.push(`Q${q.qNo} (/${q.maxMarks})`);
    });
    
    headerRow.push('Total', 'Max Marks', 'Percentage');
    
    rows.push(headerRow);
    
    // Process each sheet
    for (const doc of sheetsSnapshot.docs) {
      const sheet = doc.data();
      
      // Get identity mapping
      const identitySnapshot = await db.collection('identityMap')
        .where('sheetId', '==', sheet.sheetId)
        .limit(1)
        .get();
      
      let rollNo = 'N/A';
      let studentName = 'N/A';
      
      if (!identitySnapshot.empty) {
        const identity = identitySnapshot.docs[0].data();
        rollNo = identity.rollNo || 'N/A';
        studentName = identity.studentName || 'N/A';
      }
      
      // Get marks for this sheet
      const marksSnapshot = await db.collection('marks')
        .where('sheetId', '==', doc.id)
        .get();
      
      const marksMap = {};
      marksSnapshot.forEach(markDoc => {
        const mark = markDoc.data();
        marksMap[mark.qNo] = mark.marks;
      });
      
      // Build data row
      const dataRow = [
        sheet.sheetId,
        rollNo,
        studentName
      ];
      
      // Add mark for each question
      exam.questions.forEach(q => {
        dataRow.push(marksMap[q.qNo] !== undefined ? marksMap[q.qNo] : 'N/A');
      });
      
      // Calculate percentage
      const percentage = sheet.maxMarks > 0 
        ? ((sheet.totalMarks / sheet.maxMarks) * 100).toFixed(2)
        : '0.00';
      
      dataRow.push(sheet.totalMarks || 0, sheet.maxMarks || 0, percentage);
      
      rows.push(dataRow);
    }
    
    // Generate CSV
    const csv = stringify(rows);
    
    // Set headers for CSV download
    const filename = `marks_${examId}_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csv);
  })
);

module.exports = router;
