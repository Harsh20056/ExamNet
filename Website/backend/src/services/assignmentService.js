const { getFirestore } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');
const sheetService = require('./sheetService');
const examService = require('./examService');
const auditLog = require('./auditLog');

/**
 * Get examiner workload for an exam
 * Returns map of examiner UID -> count of assigned sheets (uploaded or in_progress)
 * 
 * @param {string} examId - Exam ID
 * @param {string} subject - Subject filter (optional)
 * @returns {Promise<object>} Map of examiner UID to sheet count
 */
async function getExaminerWorkload(examId, subject = null) {
  const db = getFirestore();
  
  // Get all users with role examiner
  const usersSnapshot = await db.collection('users')
    .where('role', '==', 'examiner')
    .get();
  
  // Filter by subject if specified
  let examiners = [];
  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    if (!subject || (userData.subjects && userData.subjects.includes(subject))) {
      examiners.push({
        uid: doc.id,
        ...userData
      });
    }
  });
  
  // Count assigned sheets for each examiner (uploaded or in_progress only)
  const workload = {};
  
  for (const examiner of examiners) {
    const sheetsSnapshot = await db.collection('sheets')
      .where('examId', '==', examId)
      .where('assignedTo', '==', examiner.uid)
      .where('status', 'in', ['uploaded', 'in_progress'])
      .get();
    
    workload[examiner.uid] = sheetsSnapshot.size;
  }
  
  return workload;
}

/**
 * Find least-loaded examiner for a subject
 * If multiple examiners have the same (minimum) workload, pick randomly
 * 
 * @param {string} examId - Exam ID
 * @param {string} subject - Subject to match
 * @returns {Promise<string|null>} Examiner UID or null if none available
 */
async function findLeastLoadedExaminer(examId, subject) {
  const workload = await getExaminerWorkload(examId, subject);
  
  if (Object.keys(workload).length === 0) {
    return null; // No examiners available for this subject
  }
  
  // Find minimum workload
  const minWorkload = Math.min(...Object.values(workload));
  
  // Get all examiners with minimum workload
  const leastLoadedExaminers = Object.keys(workload).filter(
    uid => workload[uid] === minWorkload
  );
  
  // Pick randomly among tied examiners
  const randomIndex = Math.floor(Math.random() * leastLoadedExaminers.length);
  return leastLoadedExaminers[randomIndex];
}

/**
 * Check if calibration sheet should be injected
 * Injects roughly 1 calibration sheet per CALIBRATION_EVERY sheets (default 15-20)
 * 
 * @param {string} examinerId - Examiner UID
 * @param {string} examId - Exam ID
 * @returns {Promise<boolean>} True if calibration sheet should be injected
 */
async function shouldInjectCalibration(examinerId, examId) {
  const db = getFirestore();
  
  // Get calibration frequency from env (default 15-20 range)
  const calibrationEvery = parseInt(process.env.CALIBRATION_EVERY) || 
    (15 + Math.floor(Math.random() * 6)); // Random between 15-20
  
  // Count sheets assigned to this examiner for this exam
  const sheetsSnapshot = await db.collection('sheets')
    .where('examId', '==', examId)
    .where('assignedTo', '==', examinerId)
    .get();
  
  const assignedCount = sheetsSnapshot.size;
  
  // Count calibration sheets already assigned
  let calibrationCount = 0;
  sheetsSnapshot.forEach(doc => {
    if (doc.data().isCalibration) {
      calibrationCount++;
    }
  });
  
  // Calculate expected calibration sheets
  const expectedCalibrationCount = Math.floor(assignedCount / calibrationEvery);
  
  // Inject if we're behind on calibration sheets
  return calibrationCount < expectedCalibrationCount;
}

/**
 * Get a random calibration sheet for an exam
 * Calibration sheets have goldMarks set and isCalibration=true
 * 
 * @param {string} examId - Exam ID
 * @returns {Promise<object|null>} Calibration sheet or null if none available
 */
async function getRandomCalibrationSheet(examId) {
  const db = getFirestore();
  
  // Get all calibration sheets for this exam that are not currently assigned
  const calibrationSnapshot = await db.collection('sheets')
    .where('examId', '==', examId)
    .where('isCalibration', '==', true)
    .where('assignedTo', '==', null)
    .get();
  
  if (calibrationSnapshot.empty) {
    return null;
  }
  
  // Pick random calibration sheet
  const calibrationSheets = [];
  calibrationSnapshot.forEach(doc => {
    calibrationSheets.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  const randomIndex = Math.floor(Math.random() * calibrationSheets.length);
  return calibrationSheets[randomIndex];
}

/**
 * Assign sheets to examiners using least-loaded strategy
 * Optionally injects calibration sheets
 * 
 * @param {string} examId - Exam ID
 * @param {array} sheetIds - Array of sheet IDs to assign (optional, assigns all unassigned if not provided)
 * @param {string} assignerId - User UID who is assigning
 * @param {string} assignerRole - Role of assigner
 * @param {object} io - Socket.io instance for real-time updates
 * @returns {Promise<object>} Assignment results
 */
async function assignSheets(examId, sheetIds, assignerId, assignerRole, io) {
  const db = getFirestore();
  
  // Get exam to determine subject
  const exam = await examService.getExamById(examId);
  if (!exam) {
    throw new Error('Exam not found');
  }
  
  const subject = exam.subject;
  
  // Get sheets to assign
  let sheetsToAssign = [];
  
  if (sheetIds && sheetIds.length > 0) {
    // Assign specific sheets
    for (const sheetId of sheetIds) {
      const sheet = await sheetService.getSheetById(sheetId);
      if (sheet && sheet.examId === examId && !sheet.assignedTo) {
        sheetsToAssign.push(sheet);
      }
    }
  } else {
    // Assign all unassigned sheets for this exam
    const unassignedSnapshot = await db.collection('sheets')
      .where('examId', '==', examId)
      .where('assignedTo', '==', null)
      .where('status', '==', 'uploaded')
      .get();
    
    unassignedSnapshot.forEach(doc => {
      sheetsToAssign.push({
        id: doc.id,
        ...doc.data()
      });
    });
  }
  
  const assignments = [];
  const calibrationInjections = [];
  
  // Assign each sheet
  for (const sheet of sheetsToAssign) {
    // Find least-loaded examiner
    const examinerId = await findLeastLoadedExaminer(examId, subject);
    
    if (!examinerId) {
      console.warn(`No examiner available for sheet ${sheet.id} (subject: ${subject})`);
      continue;
    }
    
    // Assign sheet
    await sheetService.assignSheet(sheet.id, examinerId, assignerId, assignerRole, io);
    
    assignments.push({
      sheetId: sheet.id,
      anonymizedId: sheet.sheetId,
      examinerId
    });
    
    // Check if we should inject a calibration sheet
    if (await shouldInjectCalibration(examinerId, examId)) {
      const calibrationSheet = await getRandomCalibrationSheet(examId);
      
      if (calibrationSheet) {
        // Assign calibration sheet
        await sheetService.assignSheet(
          calibrationSheet.id, 
          examinerId, 
          assignerId, 
          assignerRole, 
          io
        );
        
        calibrationInjections.push({
          sheetId: calibrationSheet.id,
          anonymizedId: calibrationSheet.sheetId,
          examinerId
        });
        
        console.log(`[CALIBRATION] Injected calibration sheet ${calibrationSheet.sheetId} to examiner ${examinerId}`);
      }
    }
  }
  
  return {
    assigned: assignments.length,
    assignments,
    calibrationInjections: calibrationInjections.length,
    calibrations: calibrationInjections
  };
}

/**
 * Create question-wise sub-assignments for a sheet
 * Splits marking across examiners by question
 * 
 * @param {string} sheetId - Sheet ID
 * @param {object} questionAssignments - Map of qNo -> examiner UID
 * @param {string} assignerId - User UID who is assigning
 * @param {string} assignerRole - Role of assigner
 * @returns {Promise<object>} Sub-assignment results
 */
async function createQuestionWiseAssignments(sheetId, questionAssignments, assignerId, assignerRole) {
  const db = getFirestore();
  
  // Get sheet
  const sheet = await sheetService.getSheetById(sheetId);
  if (!sheet) {
    throw new Error('Sheet not found');
  }
  
  // Get exam
  const exam = await examService.getExamById(sheet.examId);
  if (!exam) {
    throw new Error('Exam not found');
  }
  
  // Validate question assignments
  for (const qNo of Object.keys(questionAssignments)) {
    const qNoInt = parseInt(qNo);
    const question = exam.questions.find(q => q.qNo === qNoInt);
    if (!question) {
      throw new Error(`Question ${qNo} not found in exam`);
    }
  }
  
  // Create sub-assignments
  const subAssignments = [];
  
  for (const [qNo, examinerId] of Object.entries(questionAssignments)) {
    const subAssignment = {
      sheetId,
      examId: sheet.examId,
      qNo: parseInt(qNo),
      assignedTo: examinerId,
      status: 'pending', // pending, marked, merged
      createdAt: getCurrentTimestamp(),
      createdBy: assignerId
    };
    
    const docRef = await db.collection('subAssignments').add(subAssignment);
    
    subAssignments.push({
      id: docRef.id,
      ...subAssignment
    });
    
    // Audit log
    await auditLog.append({
      actor: assignerId,
      role: assignerRole,
      action: 'sub_assign',
      sheetId,
      before: null,
      after: {
        qNo: parseInt(qNo),
        assignedTo: examinerId
      },
      metadata: {
        subAssignmentId: docRef.id
      }
    });
  }
  
  // Update sheet to indicate it has sub-assignments
  await db.collection('sheets').doc(sheetId).update({
    hasSubAssignments: true,
    subAssignmentStatus: 'pending',
    updatedAt: getCurrentTimestamp()
  });
  
  return {
    sheetId: sheet.sheetId,
    subAssignments: subAssignments.length,
    assignments: subAssignments
  };
}

/**
 * Get sub-assignments for a sheet
 * 
 * @param {string} sheetId - Sheet ID
 * @returns {Promise<array>} Array of sub-assignments
 */
async function getSubAssignments(sheetId) {
  const db = getFirestore();
  
  const snapshot = await db.collection('subAssignments')
    .where('sheetId', '==', sheetId)
    .orderBy('qNo', 'asc')
    .get();
  
  const subAssignments = [];
  snapshot.forEach(doc => {
    subAssignments.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return subAssignments;
}

/**
 * Check if all sub-assignments are marked and merge totals
 * 
 * @param {string} sheetId - Sheet ID
 * @returns {Promise<object>} Merge result
 */
async function mergeSubAssignments(sheetId) {
  const db = getFirestore();
  
  // Get all sub-assignments
  const subAssignments = await getSubAssignments(sheetId);
  
  if (subAssignments.length === 0) {
    throw new Error('No sub-assignments found for this sheet');
  }
  
  // Check if all are marked
  const allMarked = subAssignments.every(sa => sa.status === 'marked');
  
  if (!allMarked) {
    const pending = subAssignments.filter(sa => sa.status === 'pending');
    return {
      merged: false,
      message: 'Not all sub-assignments are marked',
      pendingCount: pending.length,
      pending: pending.map(sa => ({ qNo: sa.qNo, assignedTo: sa.assignedTo }))
    };
  }
  
  // Get all marks
  const marks = await sheetService.getSheetMarks(sheetId);
  
  // Recalculate total
  const totalMarks = await sheetService.recalculateTotalMarks(sheetId);
  
  // Update sheet status
  await db.collection('sheets').doc(sheetId).update({
    subAssignmentStatus: 'merged',
    status: 'evaluated',
    completedAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  });
  
  // Update all sub-assignments to merged
  const batch = db.batch();
  for (const sa of subAssignments) {
    const ref = db.collection('subAssignments').doc(sa.id);
    batch.update(ref, { status: 'merged', mergedAt: getCurrentTimestamp() });
  }
  await batch.commit();
  
  return {
    merged: true,
    totalMarks,
    questionCount: marks.length,
    marks
  };
}

module.exports = {
  getExaminerWorkload,
  findLeastLoadedExaminer,
  shouldInjectCalibration,
  getRandomCalibrationSheet,
  assignSheets,
  createQuestionWiseAssignments,
  getSubAssignments,
  mergeSubAssignments
};
