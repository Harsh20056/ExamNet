/**
 * Timestamp Utilities
 * All timestamps are in ISO 8601 format (UTC)
 * Example: "2026-09-29T12:00:00.000Z"
 */

/**
 * Get current timestamp in ISO format (UTC)
 * @returns {string} ISO 8601 timestamp
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Convert Date object to ISO timestamp
 * @param {Date} date - Date object
 * @returns {string} ISO 8601 timestamp
 */
function toISOTimestamp(date) {
  if (!(date instanceof Date)) {
    throw new Error('Invalid date object');
  }
  return date.toISOString();
}

/**
 * Parse ISO timestamp to Date object
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {Date} Date object
 */
function parseTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp format');
  }
  return date;
}

/**
 * Check if timestamp is expired
 * @param {string} timestamp - ISO 8601 timestamp
 * @param {number} expiryMs - Expiry duration in milliseconds
 * @returns {boolean} True if expired
 */
function isExpired(timestamp, expiryMs) {
  const expiryTime = parseTimestamp(timestamp).getTime() + expiryMs;
  return Date.now() > expiryTime;
}

/**
 * Get timestamp for X minutes from now
 * @param {number} minutes - Number of minutes
 * @returns {string} ISO 8601 timestamp
 */
function getTimestampAfterMinutes(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

/**
 * Get timestamp for X hours from now
 * @param {number} hours - Number of hours
 * @returns {string} ISO 8601 timestamp
 */
function getTimestampAfterHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

/**
 * Calculate time difference in seconds
 * @param {string} startTimestamp - ISO 8601 timestamp
 * @param {string} endTimestamp - ISO 8601 timestamp (defaults to now)
 * @returns {number} Difference in seconds
 */
function getTimeDifferenceInSeconds(startTimestamp, endTimestamp = null) {
  const start = parseTimestamp(startTimestamp);
  const end = endTimestamp ? parseTimestamp(endTimestamp) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}

module.exports = {
  getCurrentTimestamp,
  toISOTimestamp,
  parseTimestamp,
  isExpired,
  getTimestampAfterMinutes,
  getTimestampAfterHours,
  getTimeDifferenceInSeconds
};
