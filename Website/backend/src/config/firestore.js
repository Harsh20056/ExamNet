const { getAdmin } = require('./firebaseAdmin');

/**
 * Get Firestore database instance
 * @returns {FirebaseFirestore.Firestore}
 */
function getFirestore() {
  const admin = getAdmin();
  return admin.firestore();
}

/**
 * Collection references for type safety and consistency
 */
const Collections = {
  EXAMS: 'exams',
  SHEETS: 'sheets',
  IDENTITY_MAP: 'identityMap',
  MARKS: 'marks',
  USERS: 'users',
  ALERTS: 'alerts',
  AI_CALLS: 'aiCalls',
  MODERATION: 'moderation',
  IDENTITY_VERIFICATIONS: 'identityVerifications'
};

/**
 * Sheet status enum
 */
const SheetStatus = {
  UPLOADED: 'uploaded',
  IN_PROGRESS: 'in_progress',
  EVALUATED: 'evaluated',
  FLAGGED: 'flagged',
  VERIFIED: 'verified',
  FINAL: 'final'
};

module.exports = {
  getFirestore,
  Collections,
  SheetStatus
};
