const { getFirestore, Collections, SheetStatus } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');
const { nanoid } = require('nanoid');
const auditLog = require('./auditLog');

/**
 * Create a new answer sheet with anonymized ID
 * @param {object} sheetData - Sheet data
 * @param {string} uploadedBy - User UID who uploaded
 * @param {string} uploaderRole - Role of uploader
 * @returns {Promise<object>} Created sheet with anonymized sheetId
 */
async function createSheet(sheetData, uploadedBy, uploaderRole) {
  const db = getFirestore();
  
  // Generate anonymized sheet ID
  const anonymizedSheetId = `SHEET-${nanoid(10)}`;
  
  const { rollNo, studentName, examId, pages } = sheetData;
  
  // Store identity mapping (separate collection, never exposed)
  const identityDoc = {
    sheetId: anonymizedSheetId,
    rollNo,
    studentName,
    createdAt: getCurrentTimestamp()
  };
  
  await db.collection(Collections.IDENTITY_MAP).add(identityDoc);
  
  // Store sheet without identity information
  const sheet = {
    sheetId: anonymizedSheetId,
    examId,
    pages, // Array of page image URLs or base64
    status: SheetStatus.UPLOADED,
    assignedTo: null, // Examiner UID (assigned later)
    uploadedBy,
    uploadedAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp(),
    startedAt: null,
    completedAt: null,
    totalMarks: 0,
    maxMarks: 0 // Will be set from exam definition
  };
  
  const docRef = await db.collection(Collections.SHEETS).add(sheet);
  
  // Audit log: upload
  await auditLog.append({
    actor: uploadedBy,
    role: uploaderRole,
    action: 'upload',
    sheetId: docRef.id,
    before: null,
    after: {
      sheetId: anonymizedSheetId,
      examId,
      status: SheetStatus.UPLOADED,
      pageCount: pages.length
    },
    metadata: {
      rollNo: rollNo // OK to log in audit since it's controller-only access
    }
  });
  
  return {
    id: docRef.id,
    ...sheet
  };
}

/**
 * Get sheets with optional filters
 * @param {object} filters - Filter options
 * @returns {Promise<array>} Array of sheets
 */
async function getSheets(filters = {}) {
  const db = getFirestore();
  
  let query = db.collection(Collections.SHEETS);
  
  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }
  
  if (filters.assignedTo) {
    query = query.where('assignedTo', '==', filters.assignedTo);
  }
  
  if (filters.examId) {
    query = query.where('examId', '==', filters.examId);
  }
  
  query = query.orderBy('uploadedAt', 'desc');
  
  const snapshot = await query.get();
  
  const sheets = [];
  snapshot.forEach(doc => {
    sheets.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return sheets;
}

/**
 * Get sheet by ID
 * @param {string} sheetId - Sheet document ID
 * @returns {Promise<object|null>} Sheet data or null
 */
async function getSheetById(sheetId) {
  const db = getFirestore();
  
  const doc = await db.collection(Collections.SHEETS).doc(sheetId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data()
  };
}

/**
 * Start marking a sheet
 * @param {string} sheetId - Sheet document ID
 * @param {string} examinerId - Examiner UID
 * @param {string} examinerRole - Examiner role
 * @returns {Promise<object>} Updated sheet
 */
async function startMarking(sheetId, examinerId, examinerRole) {
  const db = getFirestore();
  
  const before = await getSheetById(sheetId);
  
  const updates = {
    status: SheetStatus.IN_PROGRESS,
    assignedTo: examinerId,
    startedAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  };
  
  await db.collection(Collections.SHEETS).doc(sheetId).update(updates);
  
  const after = await getSheetById(sheetId);
  
  // Audit log: start
  await auditLog.append({
    actor: examinerId,
    role: examinerRole,
    action: 'start',
    sheetId,
    before: { status: before.status },
    after: { status: after.status, startedAt: after.startedAt }
  });
  
  return after;
}

/**
 * Save marks for a specific question
 * @param {string} sheetId - Sheet document ID
 * @param {number} qNo - Question number
 * @param {object} markData - Marks data
 * @returns {Promise<object>} Updated mark entry
 */
async function saveQuestionMarks(sheetId, qNo, markData) {
  const db = getFirestore();
  
  const { marks, comment, timeSpentSec, markedBy, markerRole } = markData;
  
  // Get existing mark if any
  const markDocId = `${sheetId}_q${qNo}`;
  const existingMarkDoc = await db.collection(Collections.MARKS).doc(markDocId).get();
  const before = existingMarkDoc.exists ? existingMarkDoc.data() : null;
  
  const markEntry = {
    sheetId,
    qNo,
    marks,
    comment: comment || '',
    timeSpentSec: timeSpentSec || 0,
    markedBy,
    markedAt: getCurrentTimestamp()
  };
  
  await db.collection(Collections.MARKS)
    .doc(markDocId)
    .set(markEntry, { merge: true });
  
  // Update sheet's updatedAt timestamp
  await db.collection(Collections.SHEETS).doc(sheetId).update({
    updatedAt: getCurrentTimestamp()
  });
  
  // Audit log: mark_save
  await auditLog.append({
    actor: markedBy,
    role: markerRole,
    action: 'mark_save',
    sheetId,
    before: before ? { qNo: before.qNo, marks: before.marks } : null,
    after: { qNo, marks },
    metadata: { timeSpentSec }
  });
  
  return markEntry;
}

/**
 * Get all marks for a sheet
 * @param {string} sheetId - Sheet document ID
 * @returns {Promise<array>} Array of marks
 */
async function getSheetMarks(sheetId) {
  const db = getFirestore();
  
  const snapshot = await db.collection(Collections.MARKS)
    .where('sheetId', '==', sheetId)
    .orderBy('qNo', 'asc')
    .get();
  
  const marks = [];
  snapshot.forEach(doc => {
    marks.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return marks;
}

/**
 * Recalculate total marks for a sheet
 * @param {string} sheetId - Sheet document ID
 * @returns {Promise<number>} New total marks
 */
async function recalculateTotalMarks(sheetId) {
  const marks = await getSheetMarks(sheetId);
  
  const total = marks.reduce((sum, mark) => sum + (mark.marks || 0), 0);
  
  const db = getFirestore();
  await db.collection(Collections.SHEETS).doc(sheetId).update({
    totalMarks: total,
    updatedAt: getCurrentTimestamp()
  });
  
  return total;
}

/**
 * Submit sheet for evaluation (with anomaly detection)
 * @param {string} sheetId - Sheet document ID
 * @param {object} exam - Exam definition
 * @param {string} submittedBy - User UID who submitted
 * @param {string} submitterRole - Role of submitter
 * @returns {Promise<object>} Updated sheet with alerts
 */
async function submitSheet(sheetId, exam, submittedBy, submitterRole) {
  const db = getFirestore();
  const anomalyEngine = require('./anomalyEngine');
  
  // Get sheet before changes
  const before = await getSheetById(sheetId);
  
  // Recalculate total before submitting
  await recalculateTotalMarks(sheetId);
  
  // Get current marks
  const marks = await getSheetMarks(sheetId);
  const sheet = await getSheetById(sheetId);
  
  // Run full anomaly check (per-sheet anomalies)
  const alerts = anomalyEngine.checkSheet(sheet, marks, exam, {}, {
    checkUnmarked: true,
    checkExceedMax: true,
    checkTotalMismatch: false,
    checkTimeAnomaly: true
  });
  
  // Run cross-sheet anomaly checks (P1, P2, P5)
  const crossSheetAlerts = await anomalyEngine.checkCrossSheetAnomalies(sheetId, sheet);
  
  // Check calibration drift if this is a calibration sheet (P4)
  let calibrationAlerts = [];
  if (sheet.isCalibration && sheet.goldMarks) {
    const calibrationCheck = await anomalyEngine.checkCalibrationDrift(sheetId, marks, sheet.goldMarks);
    calibrationAlerts = calibrationCheck.alerts;
    
    // Log calibration score
    console.log(`[CALIBRATION] Sheet ${sheet.sheetId}: Score ${calibrationCheck.score.toFixed(2)}%, ${calibrationCheck.correctQuestions}/${calibrationCheck.totalQuestions} correct`);
  }
  
  // Combine all alerts
  const allAlerts = [...alerts, ...crossSheetAlerts, ...calibrationAlerts];
  
  // Store alerts in Firestore
  const storedAlerts = await anomalyEngine.storeAlerts(sheetId, allAlerts, submittedBy, submitterRole);
  
  // Determine status based on alerts
  const hasCriticalAlerts = anomalyEngine.shouldFlagSheet(allAlerts);
  const status = hasCriticalAlerts ? SheetStatus.FLAGGED : SheetStatus.EVALUATED;
  
  const updates = {
    status,
    completedAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  };
  
  await db.collection(Collections.SHEETS).doc(sheetId).update(updates);
  
  const updatedSheet = await getSheetById(sheetId);
  
  // Audit log: submit
  await auditLog.append({
    actor: submittedBy,
    role: submitterRole,
    action: 'submit',
    sheetId,
    before: { status: before.status, totalMarks: before.totalMarks },
    after: { status: updatedSheet.status, totalMarks: updatedSheet.totalMarks },
    metadata: {
      alertCount: storedAlerts.length,
      flagged: hasCriticalAlerts
    }
  });
  
  return {
    sheet: updatedSheet,
    alerts: storedAlerts,
    hasCriticalAlerts
  };
}

/**
 * Assign sheet to examiner
 * @param {string} sheetId - Sheet document ID
 * @param {string} examinerId - Examiner UID
 * @param {string} assignerId - User UID who assigned
 * @param {string} assignerRole - Role of assigner
 * @param {object} io - Socket.io instance (optional)
 * @returns {Promise<object>} Updated sheet
 */
async function assignSheet(sheetId, examinerId, assignerId, assignerRole, io = null) {
  const db = getFirestore();
  
  const before = await getSheetById(sheetId);
  
  await db.collection(Collections.SHEETS).doc(sheetId).update({
    assignedTo: examinerId,
    updatedAt: getCurrentTimestamp()
  });
  
  const sheet = await getSheetById(sheetId);
  
  // Audit log: assign
  await auditLog.append({
    actor: assignerId,
    role: assignerRole,
    action: 'assign',
    sheetId,
    before: { assignedTo: before.assignedTo },
    after: { assignedTo: examinerId }
  });
  
  // Emit socket event if io provided
  if (io) {
    const { emitSheetAssigned } = require('./socketEmitters');
    emitSheetAssigned(io, examinerId, {
      sheetId: sheet.id,
      anonymizedId: sheet.sheetId,
      examId: sheet.examId
    });
  }
  
  return sheet;
}

module.exports = {
  createSheet,
  getSheets,
  getSheetById,
  startMarking,
  saveQuestionMarks,
  getSheetMarks,
  recalculateTotalMarks,
  submitSheet,
  assignSheet
};
