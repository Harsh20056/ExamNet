/**
 * Anomaly Detection Thresholds Configuration
 * 
 * Adjust these values to tune the sensitivity of anomaly detection
 */

const ANOMALY_THRESHOLDS = {
  // A5: Time spent anomaly detection
  TIME_SPENT_MULTIPLIER: 0.25, // Flag if time < 25% of median
  
  // Minimum time to flag (seconds) - don't flag very quick marks as anomaly
  MIN_TIME_THRESHOLD: 30,
  
  // Cross-sheet anomaly thresholds
  
  // P1: Peer deviation - minimum sample sizes
  MIN_SAMPLE_SIZE_PEER: 5, // Minimum sheets needed for peer comparison
  PEER_DEVIATION_Z_SCORE_THRESHOLD: 2.0, // Flag if z-score > 2.0
  
  // P2: Repeated totals
  MIN_SAMPLE_SIZE_REPEATED: 10, // Minimum sheets needed to check repetition
  REPEATED_TOTAL_FREQUENCY_THRESHOLD: 0.30, // Flag if > 30% of sheets have same total
  
  // P5: Speed drift
  MIN_SAMPLE_SIZE_SPEED: 10, // Minimum sheets needed to check speed drift
  SPEED_DRIFT_PERCENTAGE_THRESHOLD: 50, // Flag if speed changed by > 50%
  
  // P4: Calibration drift
  CALIBRATION_SCORE_THRESHOLD: 0.80, // Flag if calibration score < 80%
  
  // Alert severity levels
  SEVERITY: {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  }
};

/**
 * Anomaly type definitions
 */
const ANOMALY_TYPES = {
  // Per-sheet anomalies
  A1_UNMARKED_QUESTION: 'A1_UNMARKED_QUESTION',
  A3_MARKS_EXCEED_MAX: 'A3_MARKS_EXCEED_MAX',
  A4_TOTAL_MISMATCH: 'A4_TOTAL_MISMATCH',
  A5_TIME_ANOMALY: 'A5_TIME_ANOMALY',
  
  // Cross-sheet anomalies
  P1_PEER_DEVIATION: 'P1_PEER_DEVIATION',
  P2_REPEATED_TOTALS: 'P2_REPEATED_TOTALS',
  P4_CALIBRATION_DRIFT: 'P4_CALIBRATION_DRIFT',
  P5_SPEED_DRIFT: 'P5_SPEED_DRIFT',
  
  // Other anomalies
  WINDOW_BLUR: 'WINDOW_BLUR',
  SUSPICIOUS_PATTERN: 'SUSPICIOUS_PATTERN',
  IDENTITY_CHECK_FAILED: 'IDENTITY_CHECK_FAILED',
  UNVIEWED_PAGE: 'UNVIEWED_PAGE'
};

/**
 * Alert status
 */
const ALERT_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed'
};

module.exports = {
  ANOMALY_THRESHOLDS,
  ANOMALY_TYPES,
  ALERT_STATUS
};
