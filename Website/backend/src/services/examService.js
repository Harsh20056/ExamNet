const { getFirestore, Collections } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');

/**
 * Create a new exam
 * @param {object} examData - Exam data
 * @param {string} createdBy - User UID who created the exam
 * @returns {Promise<object>} Created exam with ID
 */
async function createExam(examData, createdBy) {
  const db = getFirestore();
  
  const exam = {
    ...examData,
    createdBy,
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  };
  
  const docRef = await db.collection(Collections.EXAMS).add(exam);
  
  return {
    id: docRef.id,
    ...exam
  };
}

/**
 * Get all exams
 * @returns {Promise<array>} Array of exams
 */
async function getAllExams() {
  const db = getFirestore();
  
  const snapshot = await db.collection(Collections.EXAMS)
    .orderBy('createdAt', 'desc')
    .get();
  
  const exams = [];
  snapshot.forEach(doc => {
    exams.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return exams;
}

/**
 * Get exam by ID
 * @param {string} examId - Exam ID
 * @returns {Promise<object|null>} Exam data or null
 */
async function getExamById(examId) {
  const db = getFirestore();
  
  const doc = await db.collection(Collections.EXAMS).doc(examId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data()
  };
}

/**
 * Calculate total max marks for an exam
 * @param {array} questions - Array of questions
 * @returns {number} Total max marks
 */
function calculateTotalMaxMarks(questions) {
  return questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
}

module.exports = {
  createExam,
  getAllExams,
  getExamById,
  calculateTotalMaxMarks
};
