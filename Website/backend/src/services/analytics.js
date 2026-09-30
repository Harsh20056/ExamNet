const { getFirestore } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');

/**
 * Cache for analytics results
 */
const cache = {
  data: {},
  timestamps: {}
};

const CACHE_TTL = 5000; // 5 seconds

/**
 * Get cached result or compute new one
 * @param {string} key - Cache key
 * @param {Function} computeFn - Function to compute result
 * @returns {Promise<any>} Cached or computed result
 */
async function getCached(key, computeFn) {
  const now = Date.now();
  
  if (cache.data[key] && cache.timestamps[key] && (now - cache.timestamps[key]) < CACHE_TTL) {
    return cache.data[key];
  }
  
  const result = await computeFn();
  cache.data[key] = result;
  cache.timestamps[key] = now;
  
  return result;
}

/**
 * Calculate average from array of numbers
 */
function average(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(numbers) {
  if (!numbers || numbers.length < 2) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
  const avgSquareDiff = average(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate z-score
 */
function zScore(value, mean, stdDev) {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Get examiner statistics
 * @param {string} examinerId - Examiner UID
 * @returns {Promise<object>} Examiner statistics
 */
async function getExaminerStats(examinerId) {
  return getCached(`examiner:${examinerId}`, async () => {
    const db = getFirestore();
    
    // Get all sheets assigned to this examiner
    const sheetsSnapshot = await db.collection('sheets')
      .where('assignedTo', '==', examinerId)
      .get();
    
    if (sheetsSnapshot.empty) {
      return {
        totalSheets: 0,
        completedSheets: 0,
        inProgressSheets: 0,
        averageTimePerSheet: 0,
        sheetsPerDay: 0,
        averageMarks: 0,
        averagePercentage: 0,
        overrideRate: 0,
        moderationChangeRate: 0,
        calibrationScore: 0
      };
    }
    
    const sheets = [];
    sheetsSnapshot.forEach(doc => {
      sheets.push({ id: doc.id, ...doc.data() });
    });
    
    const totalSheets = sheets.length;
    const completedSheets = sheets.filter(s => 
      s.status === 'evaluated' || s.status === 'flagged' || s.status === 'final'
    ).length;
    const inProgressSheets = sheets.filter(s => s.status === 'in_progress').length;
    
    // Calculate average time per sheet (in seconds)
    const timings = [];
    for (const sheet of sheets) {
      if (sheet.startedAt && sheet.completedAt) {
        const started = new Date(sheet.startedAt).getTime();
        const completed = new Date(sheet.completedAt).getTime();
        const duration = (completed - started) / 1000; // seconds
        if (duration > 0) {
          timings.push(duration);
        }
      }
    }
    const averageTimePerSheet = timings.length > 0 ? average(timings) : 0;
    
    // Calculate sheets per day
    const completedWithDates = sheets.filter(s => s.completedAt);
    let sheetsPerDay = 0;
    if (completedWithDates.length > 0) {
      const dates = completedWithDates.map(s => new Date(s.completedAt).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const days = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      sheetsPerDay = days > 0 ? completedWithDates.length / days : completedWithDates.length;
    }
    
    // Calculate average marks and percentage
    const marks = completedWithDates.map(s => ({
      total: s.totalMarks || 0,
      max: s.maxMarks || 1
    }));
    const averageMarks = marks.length > 0 ? average(marks.map(m => m.total)) : 0;
    const averagePercentage = marks.length > 0 ? 
      average(marks.map(m => (m.total / m.max) * 100)) : 0;
    
    // Calculate override rate (AI decisions overridden)
    const aiCallsSnapshot = await db.collection('aiCalls')
      .where('requestedBy', '==', examinerId)
      .get();
    
    let totalDecisions = 0;
    let overriddenDecisions = 0;
    aiCallsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.decision && data.decision.type) {
        totalDecisions++;
        if (data.decision.type === 'overridden') {
          overriddenDecisions++;
        }
      }
    });
    const overrideRate = totalDecisions > 0 ? (overriddenDecisions / totalDecisions) * 100 : 0;
    
    // Calculate moderation change rate (sheets adjusted by moderator)
    const moderationSnapshot = await db.collection('moderation')
      .where('sheetId', 'in', sheets.map(s => s.id))
      .get();
    
    let adjustedCount = 0;
    moderationSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.action === 'adjust') {
        adjustedCount++;
      }
    });
    const moderationChangeRate = completedSheets > 0 ? 
      (adjustedCount / completedSheets) * 100 : 0;
    
    // Calculate calibration score (1.0 = perfect, lower = more variance from peers)
    // This is a simplified score: 1.0 - (moderation_change_rate / 100) * 0.5 - (override_rate / 100) * 0.3
    const calibrationScore = Math.max(0, 
      1.0 - (moderationChangeRate / 100) * 0.5 - (overrideRate / 100) * 0.3
    );
    
    return {
      totalSheets,
      completedSheets,
      inProgressSheets,
      averageTimePerSheet,
      sheetsPerDay,
      averageMarks,
      averagePercentage,
      overrideRate,
      moderationChangeRate,
      calibrationScore
    };
  });
}

/**
 * Get all examiners with their statistics
 * @returns {Promise<object[]>} Array of examiner stats
 */
async function getAllExaminersStats() {
  return getCached('all-examiners', async () => {
    const db = getFirestore();
    
    // Get all users with examiner role
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'examiner')
      .get();
    
    if (usersSnapshot.empty) {
      return [];
    }
    
    const examiners = [];
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const stats = await getExaminerStats(doc.id);
      
      examiners.push({
        uid: doc.id,
        name: userData.name,
        email: userData.email,
        ...stats
      });
    }
    
    // Calculate peer statistics for deviation and z-scores
    const averageMarksArray = examiners
      .filter(e => e.averageMarks > 0)
      .map(e => e.averageMarks);
    
    const peerMean = average(averageMarksArray);
    const peerStdDev = standardDeviation(averageMarksArray);
    
    const averagePercentageArray = examiners
      .filter(e => e.averagePercentage > 0)
      .map(e => e.averagePercentage);
    
    const peerPercentageMean = average(averagePercentageArray);
    const peerPercentageStdDev = standardDeviation(averagePercentageArray);
    
    // Add deviation and z-scores to each examiner
    for (const examiner of examiners) {
      examiner.deviationFromPeerMean = examiner.averageMarks - peerMean;
      examiner.zScore = zScore(examiner.averageMarks, peerMean, peerStdDev);
      
      examiner.percentageDeviationFromPeerMean = examiner.averagePercentage - peerPercentageMean;
      examiner.percentageZScore = zScore(
        examiner.averagePercentage, 
        peerPercentageMean, 
        peerPercentageStdDev
      );
    }
    
    return examiners;
  });
}

/**
 * Get examiner statistics with peer comparison
 * @param {string} examinerId - Examiner UID
 * @returns {Promise<object>} Examiner stats with peer comparison
 */
async function getExaminerStatsWithPeerComparison(examinerId) {
  const allExaminers = await getAllExaminersStats();
  const examinerStats = allExaminers.find(e => e.uid === examinerId);
  
  if (!examinerStats) {
    return null;
  }
  
  // Calculate peer statistics (excluding current examiner)
  const peers = allExaminers.filter(e => e.uid !== examinerId);
  const peerAverageMarks = peers.map(e => e.averageMarks).filter(m => m > 0);
  const peerAveragePercentage = peers.map(e => e.averagePercentage).filter(p => p > 0);
  
  return {
    ...examinerStats,
    peerComparison: {
      peerMean: average(peerAverageMarks),
      peerStdDev: standardDeviation(peerAverageMarks),
      peerPercentageMean: average(peerAveragePercentage),
      peerPercentageStdDev: standardDeviation(peerAveragePercentage),
      peerCount: peers.length
    }
  };
}

/**
 * Get progress statistics
 * @returns {Promise<object>} Progress statistics
 */
async function getProgressStats() {
  return getCached('progress', async () => {
    const db = getFirestore();
    
    // Get all sheets
    const sheetsSnapshot = await db.collection('sheets').get();
    
    if (sheetsSnapshot.empty) {
      return {
        overall: {
          total: 0,
          uploaded: 0,
          inProgress: 0,
          evaluated: 0,
          flagged: 0,
          final: 0
        },
        byExaminer: [],
        bySubject: [],
        predictedCompletion: null
      };
    }
    
    const sheets = [];
    sheetsSnapshot.forEach(doc => {
      sheets.push({ id: doc.id, ...doc.data() });
    });
    
    // Overall counts by status
    const overall = {
      total: sheets.length,
      uploaded: sheets.filter(s => s.status === 'uploaded').length,
      inProgress: sheets.filter(s => s.status === 'in_progress').length,
      evaluated: sheets.filter(s => s.status === 'evaluated').length,
      flagged: sheets.filter(s => s.status === 'flagged').length,
      final: sheets.filter(s => s.status === 'final').length
    };
    
    // Counts by examiner
    const examinerMap = {};
    for (const sheet of sheets) {
      if (sheet.assignedTo) {
        if (!examinerMap[sheet.assignedTo]) {
          examinerMap[sheet.assignedTo] = {
            uid: sheet.assignedTo,
            total: 0,
            uploaded: 0,
            inProgress: 0,
            evaluated: 0,
            flagged: 0,
            final: 0
          };
        }
        examinerMap[sheet.assignedTo].total++;
        examinerMap[sheet.assignedTo][sheet.status]++;
      }
    }
    
    // Get examiner names
    const examinerUids = Object.keys(examinerMap);
    for (const uid of examinerUids) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        examinerMap[uid].name = userDoc.data().name;
      }
    }
    
    const byExaminer = Object.values(examinerMap);
    
    // Counts by subject (via exam)
    const subjectMap = {};
    const examCache = {};
    
    for (const sheet of sheets) {
      if (!examCache[sheet.examId]) {
        const examDoc = await db.collection('exams').doc(sheet.examId).get();
        if (examDoc.exists) {
          examCache[sheet.examId] = examDoc.data();
        }
      }
      
      const exam = examCache[sheet.examId];
      if (exam && exam.subject) {
        if (!subjectMap[exam.subject]) {
          subjectMap[exam.subject] = {
            subject: exam.subject,
            total: 0,
            uploaded: 0,
            inProgress: 0,
            evaluated: 0,
            flagged: 0,
            final: 0
          };
        }
        subjectMap[exam.subject].total++;
        subjectMap[exam.subject][sheet.status]++;
      }
    }
    
    const bySubject = Object.values(subjectMap);
    
    // Predicted completion
    const completedSheets = sheets.filter(s => 
      s.status === 'evaluated' || s.status === 'flagged' || s.status === 'final'
    );
    const remainingSheets = sheets.filter(s => 
      s.status === 'uploaded' || s.status === 'in_progress'
    );
    
    let predictedCompletion = null;
    
    if (completedSheets.length > 0 && remainingSheets.length > 0) {
      // Calculate recent sheets per hour (last completed sheets)
      const recentCompleted = completedSheets
        .filter(s => s.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, Math.min(10, completedSheets.length)); // Last 10 sheets
      
      if (recentCompleted.length >= 2) {
        const times = recentCompleted.map(s => new Date(s.completedAt).getTime());
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const hours = (maxTime - minTime) / (1000 * 60 * 60);
        
        if (hours > 0) {
          const sheetsPerHour = recentCompleted.length / hours;
          const hoursRemaining = remainingSheets.length / sheetsPerHour;
          const estimatedCompletionTime = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
          
          predictedCompletion = {
            remainingSheets: remainingSheets.length,
            recentSheetsPerHour: Math.round(sheetsPerHour * 100) / 100,
            estimatedHoursRemaining: Math.round(hoursRemaining * 100) / 100,
            estimatedCompletionTime: estimatedCompletionTime.toISOString()
          };
        }
      }
    }
    
    return {
      overall,
      byExaminer,
      bySubject,
      predictedCompletion
    };
  });
}

module.exports = {
  getExaminerStats,
  getAllExaminersStats,
  getExaminerStatsWithPeerComparison,
  getProgressStats,
  // Export utility functions for testing
  average,
  standardDeviation,
  zScore
};
