const { getFirestore, Collections } = require('../config/firestore');
const { 
  ANOMALY_THRESHOLDS, 
  ANOMALY_TYPES, 
  ALERT_STATUS 
} = require('../config/anomalyThresholds');
const { getCurrentTimestamp } = require('../utils/timestamp');

/**
 * Calculate median time spent across all marks
 * @param {array} marks - Array of mark entries
 * @returns {number} Median time in seconds
 */
function calculateMedianTime(marks) {
  if (!marks || marks.length === 0) return 0;
  
  const times = marks
    .map(m => m.timeSpentSec || 0)
    .filter(t => t > 0)
    .sort((a, b) => a - b);
  
  if (times.length === 0) return 0;
  
  const mid = Math.floor(times.length / 2);
  
  if (times.length % 2 === 0) {
    return (times[mid - 1] + times[mid]) / 2;
  } else {
    return times[mid];
  }
}

/**
 * Check for A1: Unmarked questions
 * @param {object} exam - Exam definition
 * @param {array} marks - Current marks
 * @returns {array} Array of alerts
 */
function checkUnmarkedQuestions(exam, marks) {
  const alerts = [];
  const markedQuestions = new Set(marks.map(m => m.qNo));
  
  for (const question of exam.questions) {
    if (!markedQuestions.has(question.qNo)) {
      alerts.push({
        type: ANOMALY_TYPES.A1_UNMARKED_QUESTION,
        severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
        message: `Question ${question.qNo} is unmarked`,
        metadata: {
          questionNo: question.qNo,
          maxMarks: question.maxMarks
        }
      });
    }
  }
  
  return alerts;
}

/**
 * Check for A3: Marks exceed maximum
 * @param {object} exam - Exam definition
 * @param {array} marks - Current marks
 * @returns {array} Array of alerts
 */
function checkMarksExceedMax(exam, marks) {
  const alerts = [];
  
  for (const mark of marks) {
    const question = exam.questions.find(q => q.qNo === mark.qNo);
    
    if (!question) continue;
    
    if (mark.marks > question.maxMarks) {
      alerts.push({
        type: ANOMALY_TYPES.A3_MARKS_EXCEED_MAX,
        severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
        message: `Marks for Q${mark.qNo} (${mark.marks}) exceed maximum (${question.maxMarks})`,
        metadata: {
          questionNo: mark.qNo,
          marksGiven: mark.marks,
          maxMarks: question.maxMarks,
          difference: mark.marks - question.maxMarks
        }
      });
    }
  }
  
  return alerts;
}

/**
 * Check for A4: Client total differs from server sum
 * @param {number} clientTotal - Total provided by client (if any)
 * @param {number} serverTotal - Calculated server total
 * @returns {array} Array of alerts
 */
function checkTotalMismatch(clientTotal, serverTotal) {
  const alerts = [];
  
  // Only check if client provided a total
  if (clientTotal !== undefined && clientTotal !== null) {
    if (clientTotal !== serverTotal) {
      alerts.push({
        type: ANOMALY_TYPES.A4_TOTAL_MISMATCH,
        severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
        message: `Client total (${clientTotal}) differs from server total (${serverTotal})`,
        metadata: {
          clientTotal,
          serverTotal,
          difference: Math.abs(clientTotal - serverTotal)
        }
      });
    }
  }
  
  return alerts;
}

/**
 * Check for A5: Time spent anomaly (too fast)
 * @param {array} marks - Current marks
 * @param {object} stats - Optional stats object with median time
 * @returns {array} Array of alerts
 */
function checkTimeAnomaly(marks, stats = {}) {
  const alerts = [];
  
  // Calculate median time if not provided
  const medianTime = stats.medianTime || calculateMedianTime(marks);
  
  if (medianTime === 0) return alerts; // Can't check if no median
  
  const threshold = medianTime * ANOMALY_THRESHOLDS.TIME_SPENT_MULTIPLIER;
  
  for (const mark of marks) {
    const timeSpent = mark.timeSpentSec || 0;
    
    // Skip if no time recorded or very short (expected for some cases)
    if (timeSpent === 0 || timeSpent < ANOMALY_THRESHOLDS.MIN_TIME_THRESHOLD) {
      continue;
    }
    
    if (timeSpent < threshold) {
      alerts.push({
        type: ANOMALY_TYPES.A5_TIME_ANOMALY,
        severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
        message: `Q${mark.qNo} marked too quickly (${timeSpent}s vs median ${Math.round(medianTime)}s)`,
        metadata: {
          questionNo: mark.qNo,
          timeSpent,
          medianTime: Math.round(medianTime),
          threshold: Math.round(threshold),
          percentageOfMedian: Math.round((timeSpent / medianTime) * 100)
        }
      });
    }
  }
  
  return alerts;
}

/**
 * Check sheet for anomalies
 * 
 * @param {object} sheet - Sheet document
 * @param {array} marks - Array of mark entries
 * @param {object} exam - Exam definition
 * @param {object} stats - Optional statistics (e.g., medianTime)
 * @param {object} options - Check options
 * @returns {array} Array of alert objects
 */
function checkSheet(sheet, marks, exam, stats = {}, options = {}) {
  const alerts = [];
  
  const {
    checkUnmarked = true,
    checkExceedMax = true,
    checkTotalMismatch = false,
    checkTimeAnomaly = true,
    clientTotal = null
  } = options;
  
  // A1: Unmarked questions
  if (checkUnmarked) {
    alerts.push(...checkUnmarkedQuestions(exam, marks));
  }
  
  // A3: Marks exceed maximum
  if (checkExceedMax) {
    alerts.push(...checkMarksExceedMax(exam, marks));
  }
  
  // A4: Client total mismatch
  if (checkTotalMismatch && clientTotal !== null) {
    const serverTotal = marks.reduce((sum, m) => sum + (m.marks || 0), 0);
    alerts.push(...checkTotalMismatch(clientTotal, serverTotal));
  }
  
  // A5: Time anomaly
  if (checkTimeAnomaly) {
    alerts.push(...checkTimeAnomaly(marks, stats));
  }
  
  return alerts;
}

/**
 * Check for quick anomalies when saving individual marks
 * (Only A3 - marks exceed max)
 * 
 * @param {object} mark - Mark entry
 * @param {object} question - Question definition
 * @returns {array} Array of alert objects
 */
function quickCheck(mark, question) {
  const alerts = [];
  
  // A3: Check if marks exceed maximum
  if (mark.marks > question.maxMarks) {
    alerts.push({
      type: ANOMALY_TYPES.A3_MARKS_EXCEED_MAX,
      severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
      message: `Marks for Q${mark.qNo} (${mark.marks}) exceed maximum (${question.maxMarks})`,
      metadata: {
        questionNo: mark.qNo,
        marksGiven: mark.marks,
        maxMarks: question.maxMarks,
        difference: mark.marks - question.maxMarks
      }
    });
  }
  
  return alerts;
}

/**
 * Store alerts in Firestore
 * 
 * @param {string} sheetId - Sheet document ID
 * @param {array} alerts - Array of alert objects
 * @param {string} detectedBy - User UID who triggered the check
 * @param {string} detectorRole - Role of detector (default 'system')
 * @returns {Promise<array>} Array of created alert documents
 */
async function storeAlerts(sheetId, alerts, detectedBy, detectorRole = 'system') {
  if (!alerts || alerts.length === 0) return [];
  
  const db = getFirestore();
  const auditLog = require('./auditLog');
  const storedAlerts = [];
  
  for (const alert of alerts) {
    const alertDoc = {
      sheetId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata || {},
      status: ALERT_STATUS.PENDING,
      detectedBy,
      detectedAt: getCurrentTimestamp(),
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null
    };
    
    const docRef = await db.collection('alerts').add(alertDoc);
    
    storedAlerts.push({
      id: docRef.id,
      ...alertDoc
    });
    
    // Audit log: alert_create
    await auditLog.append({
      actor: detectedBy,
      role: detectorRole,
      action: 'alert_create',
      sheetId,
      before: null,
      after: {
        alertType: alert.type,
        severity: alert.severity
      },
      metadata: alert.metadata || {}
    });
  }
  
  return storedAlerts;
}

/**
 * Determine if sheet should be flagged based on alerts
 * 
 * @param {array} alerts - Array of alert objects
 * @returns {boolean} True if sheet should be flagged
 */
function shouldFlagSheet(alerts) {
  return alerts.some(alert => alert.severity === ANOMALY_THRESHOLDS.SEVERITY.HIGH);
}

/**
 * Get alert summary for a sheet
 * 
 * @param {string} sheetId - Sheet document ID
 * @returns {Promise<object>} Alert summary
 */
async function getAlertSummary(sheetId) {
  const db = getFirestore();
  
  const snapshot = await db.collection('alerts')
    .where('sheetId', '==', sheetId)
    .where('status', '==', ALERT_STATUS.PENDING)
    .get();
  
  const alerts = [];
  snapshot.forEach(doc => {
    alerts.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  const summary = {
    total: alerts.length,
    high: alerts.filter(a => a.severity === ANOMALY_THRESHOLDS.SEVERITY.HIGH).length,
    medium: alerts.filter(a => a.severity === ANOMALY_THRESHOLDS.SEVERITY.MEDIUM).length,
    low: alerts.filter(a => a.severity === ANOMALY_THRESHOLDS.SEVERITY.LOW).length,
    alerts
  };
  
  return summary;
}

/**
 * Calculate average and standard deviation for array of numbers
 */
function calculateStats(numbers) {
  if (!numbers || numbers.length === 0) {
    return { mean: 0, stdDev: 0 };
  }
  
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  
  if (numbers.length < 2) {
    return { mean, stdDev: 0 };
  }
  
  const squareDiffs = numbers.map(n => Math.pow(n - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
  const stdDev = Math.sqrt(avgSquareDiff);
  
  return { mean, stdDev };
}

/**
 * Check for P1: Peer deviation (examiner's average well above peers)
 * @param {string} examinerId - Examiner UID
 * @param {string} examId - Exam ID
 * @param {number} currentPercentage - Current sheet percentage
 * @returns {Promise<array>} Array of alerts
 */
async function checkPeerDeviation(examinerId, examId, currentPercentage) {
  const alerts = [];
  const db = getFirestore();
  
  // Get all completed sheets for this exam by this examiner
  const examinerSheetsSnapshot = await db.collection('sheets')
    .where('assignedTo', '==', examinerId)
    .where('examId', '==', examId)
    .where('status', 'in', ['evaluated', 'flagged', 'final'])
    .get();
  
  // Need minimum sample size
  if (examinerSheetsSnapshot.size < ANOMALY_THRESHOLDS.MIN_SAMPLE_SIZE_PEER) {
    return alerts; // Not enough data
  }
  
  // Calculate examiner's average percentage
  const examinerPercentages = [];
  examinerSheetsSnapshot.forEach(doc => {
    const sheet = doc.data();
    if (sheet.totalMarks && sheet.maxMarks && sheet.maxMarks > 0) {
      examinerPercentages.push((sheet.totalMarks / sheet.maxMarks) * 100);
    }
  });
  
  if (examinerPercentages.length < ANOMALY_THRESHOLDS.MIN_SAMPLE_SIZE_PEER) {
    return alerts;
  }
  
  const examinerMean = examinerPercentages.reduce((sum, p) => sum + p, 0) / examinerPercentages.length;
  
  // Get all other examiners' sheets for this exam
  const allSheetsSnapshot = await db.collection('sheets')
    .where('examId', '==', examId)
    .where('status', 'in', ['evaluated', 'flagged', 'final'])
    .get();
  
  const peerPercentages = [];
  allSheetsSnapshot.forEach(doc => {
    const sheet = doc.data();
    // Exclude current examiner
    if (sheet.assignedTo !== examinerId && sheet.totalMarks && sheet.maxMarks && sheet.maxMarks > 0) {
      peerPercentages.push((sheet.totalMarks / sheet.maxMarks) * 100);
    }
  });
  
  // Need minimum peer sample size
  if (peerPercentages.length < ANOMALY_THRESHOLDS.MIN_SAMPLE_SIZE_PEER) {
    return alerts; // Not enough peer data
  }
  
  const peerStats = calculateStats(peerPercentages);
  const deviation = examinerMean - peerStats.mean;
  const zScore = peerStats.stdDev > 0 ? deviation / peerStats.stdDev : 0;
  
  // Flag if z-score > 2.0 (significantly higher than peers)
  if (zScore > ANOMALY_THRESHOLDS.PEER_DEVIATION_Z_SCORE_THRESHOLD) {
    alerts.push({
      type: ANOMALY_TYPES.P1_PEER_DEVIATION,
      severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
      message: `Examiner's average marks (${Math.round(examinerMean)}%) significantly higher than peers (${Math.round(peerStats.mean)}%)`,
      metadata: {
        examinerMean: Math.round(examinerMean * 100) / 100,
        peerMean: Math.round(peerStats.mean * 100) / 100,
        deviation: Math.round(deviation * 100) / 100,
        zScore: Math.round(zScore * 100) / 100,
        examinerSampleSize: examinerPercentages.length,
        peerSampleSize: peerPercentages.length
      }
    });
  }
  
  return alerts;
}

/**
 * Check for P2: Repeated totals (same total appears too frequently)
 * @param {string} examinerId - Examiner UID
 * @param {string} examId - Exam ID
 * @param {number} currentTotal - Current sheet total
 * @returns {Promise<array>} Array of alerts
 */
async function checkRepeatedTotals(examinerId, examId, currentTotal) {
  const alerts = [];
  const db = getFirestore();
  
  // Get examiner's recent sheets for this exam
  const sheetsSnapshot = await db.collection('sheets')
    .where('assignedTo', '==', examinerId)
    .where('examId', '==', examId)
    .where('status', 'in', ['evaluated', 'flagged', 'final'])
    .get();
  
  // Need minimum sample size
  if (sheetsSnapshot.size < ANOMALY_THRESHOLDS.MIN_SAMPLE_SIZE_REPEATED) {
    return alerts;
  }
  
  // Count frequency of each total
  const totalCounts = {};
  let totalSheets = 0;
  
  sheetsSnapshot.forEach(doc => {
    const sheet = doc.data();
    const total = sheet.totalMarks || 0;
    totalCounts[total] = (totalCounts[total] || 0) + 1;
    totalSheets++;
  });
  
  // Check if current total appears too frequently
  const currentCount = totalCounts[currentTotal] || 0;
  const frequency = currentCount / totalSheets;
  
  // Flag if same total appears in > 30% of sheets
  if (frequency > ANOMALY_THRESHOLDS.REPEATED_TOTAL_FREQUENCY_THRESHOLD) {
    alerts.push({
      type: ANOMALY_TYPES.P2_REPEATED_TOTALS,
      severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
      message: `Total marks ${currentTotal} appears in ${Math.round(frequency * 100)}% of sheets`,
      metadata: {
        total: currentTotal,
        occurrences: currentCount,
        totalSheets,
        frequency: Math.round(frequency * 100) / 100,
        frequencyPercentage: Math.round(frequency * 100)
      }
    });
  }
  
  return alerts;
}

/**
 * Check for P5: Speed drift (examiner's marking speed changed significantly)
 * @param {string} examinerId - Examiner UID
 * @param {number} currentTime - Current sheet time in seconds
 * @returns {Promise<array>} Array of alerts
 */
async function checkSpeedDrift(examinerId, currentTime) {
  const alerts = [];
  const db = getFirestore();
  
  // Get examiner's recent completed sheets (last 20)
  const sheetsSnapshot = await db.collection('sheets')
    .where('assignedTo', '==', examinerId)
    .where('status', 'in', ['evaluated', 'flagged', 'final'])
    .orderBy('completedAt', 'desc')
    .limit(20)
    .get();
  
  // Need minimum sample size
  if (sheetsSnapshot.size < ANOMALY_THRESHOLDS.MIN_SAMPLE_SIZE_SPEED) {
    return alerts;
  }
  
  // Calculate time spent for each sheet
  const times = [];
  sheetsSnapshot.forEach(doc => {
    const sheet = doc.data();
    if (sheet.startedAt && sheet.completedAt) {
      const started = new Date(sheet.startedAt).getTime();
      const completed = new Date(sheet.completedAt).getTime();
      const duration = (completed - started) / 1000; // seconds
      if (duration > 0) {
        times.push(duration);
      }
    }
  });
  
  if (times.length < ANOMALY_THRESHOLDS.MIN_SAMPLE_SIZE_SPEED) {
    return alerts;
  }
  
  // Calculate baseline (first half of sheets)
  const halfPoint = Math.floor(times.length / 2);
  const baselineTimes = times.slice(halfPoint); // Older sheets
  const recentTimes = times.slice(0, halfPoint); // Recent sheets
  
  if (baselineTimes.length < 2 || recentTimes.length < 2) {
    return alerts;
  }
  
  const baselineStats = calculateStats(baselineTimes);
  const recentStats = calculateStats(recentTimes);
  
  // Check if recent average is significantly different from baseline
  const percentageChange = ((recentStats.mean - baselineStats.mean) / baselineStats.mean) * 100;
  
  // Flag if speed changed by more than 50% (either faster or slower)
  if (Math.abs(percentageChange) > ANOMALY_THRESHOLDS.SPEED_DRIFT_PERCENTAGE_THRESHOLD) {
    const direction = percentageChange > 0 ? 'slower' : 'faster';
    
    alerts.push({
      type: ANOMALY_TYPES.P5_SPEED_DRIFT,
      severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
      message: `Marking speed changed significantly: ${Math.abs(Math.round(percentageChange))}% ${direction}`,
      metadata: {
        baselineAverage: Math.round(baselineStats.mean),
        recentAverage: Math.round(recentStats.mean),
        percentageChange: Math.round(percentageChange * 100) / 100,
        direction,
        baselineSampleSize: baselineTimes.length,
        recentSampleSize: recentTimes.length
      }
    });
  }
  
  return alerts;
}

/**
 * Check for P4: Calibration drift (examiner's marks differ from gold standard)
 * @param {string} sheetId - Sheet ID
 * @param {array} marks - Examiner's marks
 * @param {array} goldMarks - Gold standard marks (array of {qNo, marks})
 * @returns {Promise<object>} Calibration check result with alerts
 */
async function checkCalibrationDrift(sheetId, marks, goldMarks) {
  const alerts = [];
  
  if (!goldMarks || goldMarks.length === 0) {
    return { alerts, score: 100, correctQuestions: 0, totalQuestions: 0 };
  }
  
  // Create map of gold marks
  const goldMap = {};
  goldMarks.forEach(gm => {
    goldMap[gm.qNo] = gm.marks;
  });
  
  // Compare examiner's marks with gold marks
  let correctQuestions = 0;
  let totalQuestions = 0;
  const differences = [];
  
  for (const mark of marks) {
    if (goldMap[mark.qNo] !== undefined) {
      totalQuestions++;
      const goldMark = goldMap[mark.qNo];
      const examinerMark = mark.marks;
      const difference = Math.abs(examinerMark - goldMark);
      
      differences.push({
        qNo: mark.qNo,
        examinerMark,
        goldMark,
        difference
      });
      
      // Consider "correct" if difference is 0 or within 10% of gold mark
      const tolerance = Math.max(0.1, goldMark * 0.1);
      if (difference <= tolerance) {
        correctQuestions++;
      }
    }
  }
  
  if (totalQuestions === 0) {
    return { alerts, score: 100, correctQuestions: 0, totalQuestions: 0 };
  }
  
  // Calculate calibration score
  const score = (correctQuestions / totalQuestions) * 100;
  
  // Flag if score is below threshold (80%)
  if (score < ANOMALY_THRESHOLDS.CALIBRATION_SCORE_THRESHOLD * 100) {
    // Find questions with largest differences
    const sortedDifferences = differences
      .sort((a, b) => b.difference - a.difference)
      .slice(0, 3); // Top 3 differences
    
    alerts.push({
      type: ANOMALY_TYPES.P4_CALIBRATION_DRIFT,
      severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
      message: `Calibration drift detected: ${score.toFixed(1)}% match with gold standard (${correctQuestions}/${totalQuestions} questions)`,
      metadata: {
        calibrationScore: Math.round(score * 100) / 100,
        correctQuestions,
        totalQuestions,
        threshold: ANOMALY_THRESHOLDS.CALIBRATION_SCORE_THRESHOLD * 100,
        topDifferences: sortedDifferences
      }
    });
  }
  
  return {
    alerts,
    score,
    correctQuestions,
    totalQuestions,
    differences
  };
}

/**
 * Check for cross-sheet anomalies (P1, P2, P5)
 * Run after sheet submission
 * 
 * @param {string} sheetId - Sheet document ID
 * @param {object} sheet - Sheet document
 * @returns {Promise<array>} Array of alert objects
 */
async function checkCrossSheetAnomalies(sheetId, sheet) {
  const alerts = [];
  
  if (!sheet.assignedTo || !sheet.examId) {
    return alerts;
  }
  
  // Calculate current sheet percentage
  const currentPercentage = sheet.maxMarks > 0 ? 
    (sheet.totalMarks / sheet.maxMarks) * 100 : 0;
  
  // Calculate current sheet time
  let currentTime = 0;
  if (sheet.startedAt && sheet.completedAt) {
    const started = new Date(sheet.startedAt).getTime();
    const completed = new Date(sheet.completedAt).getTime();
    currentTime = (completed - started) / 1000; // seconds
  }
  
  // P1: Peer deviation
  const p1Alerts = await checkPeerDeviation(sheet.assignedTo, sheet.examId, currentPercentage);
  alerts.push(...p1Alerts);
  
  // P2: Repeated totals
  const p2Alerts = await checkRepeatedTotals(sheet.assignedTo, sheet.examId, sheet.totalMarks);
  alerts.push(...p2Alerts);
  
  // P5: Speed drift
  if (currentTime > 0) {
    const p5Alerts = await checkSpeedDrift(sheet.assignedTo, currentTime);
    alerts.push(...p5Alerts);
  }
  
  return alerts;
}

module.exports = {
  checkSheet,
  quickCheck,
  storeAlerts,
  shouldFlagSheet,
  getAlertSummary,
  calculateMedianTime,
  checkCalibrationDrift,
  checkCrossSheetAnomalies,
  // Export for testing
  checkPeerDeviation,
  checkRepeatedTotals,
  checkSpeedDrift
};
