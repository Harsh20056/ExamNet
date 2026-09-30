const crypto = require('crypto');
const { getFirestore } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');

/**
 * Calculate SHA256 hash
 * @param {string} data - Data to hash
 * @returns {string} Hex hash
 */
function calculateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Append audit log entry with blockchain-style hashing
 * 
 * @param {object} entry - Audit entry
 * @param {string} entry.actor - User UID performing action
 * @param {string} entry.role - User role at time of action
 * @param {string} entry.action - Action type (e.g., 'upload', 'submit')
 * @param {string} entry.sheetId - Sheet ID (optional)
 * @param {object} entry.before - State before action (optional)
 * @param {object} entry.after - State after action (optional)
 * @param {object} entry.metadata - Additional metadata (optional)
 * @returns {Promise<object>} Created audit entry
 */
async function append(entry) {
  const db = getFirestore();
  const auditRef = db.collection('audit');
  
  // Use transaction to ensure sequential consistency
  return db.runTransaction(async (transaction) => {
    // Get the last entry to chain from it
    const lastEntrySnapshot = await transaction.get(
      auditRef.orderBy('seq', 'desc').limit(1)
    );
    
    let seq = 1;
    let prevHash = 'GENESIS';
    
    if (!lastEntrySnapshot.empty) {
      const lastEntry = lastEntrySnapshot.docs[0].data();
      seq = (lastEntry.seq || 0) + 1;
      prevHash = lastEntry.hash;
    }
    
    // Build audit entry
    const auditEntry = {
      seq,
      ts: getCurrentTimestamp(),
      actor: entry.actor,
      role: entry.role,
      action: entry.action,
      sheetId: entry.sheetId || null,
      before: entry.before || null,
      after: entry.after || null,
      metadata: entry.metadata || null,
      prevHash
    };
    
    // Calculate hash of this entry
    // Hash = SHA256(JSON body + prevHash)
    const bodyToHash = JSON.stringify({
      seq: auditEntry.seq,
      ts: auditEntry.ts,
      actor: auditEntry.actor,
      role: auditEntry.role,
      action: auditEntry.action,
      sheetId: auditEntry.sheetId,
      before: auditEntry.before,
      after: auditEntry.after,
      metadata: auditEntry.metadata
    }) + prevHash;
    
    auditEntry.hash = calculateHash(bodyToHash);
    
    // Write to Firestore
    const newDocRef = auditRef.doc();
    transaction.set(newDocRef, auditEntry);
    
    return {
      id: newDocRef.id,
      ...auditEntry
    };
  });
}

/**
 * Verify audit log integrity
 * Recomputes all hashes in sequence and checks for tampering
 * 
 * @returns {Promise<object>} Verification result
 */
async function verify() {
  const db = getFirestore();
  
  // Get all audit entries in sequence order
  const snapshot = await db.collection('audit')
    .orderBy('seq', 'asc')
    .get();
  
  if (snapshot.empty) {
    return {
      status: 'OK',
      message: 'Audit log is empty',
      totalEntries: 0,
      verifiedEntries: 0
    };
  }
  
  let prevHash = 'GENESIS';
  let verifiedCount = 0;
  
  for (const doc of snapshot.docs) {
    const entry = doc.data();
    
    // Check if prevHash matches expected
    if (entry.prevHash !== prevHash) {
      return {
        status: 'INVALID',
        message: 'Chain broken: prevHash mismatch',
        failedEntry: {
          id: doc.id,
          seq: entry.seq,
          expectedPrevHash: prevHash,
          actualPrevHash: entry.prevHash
        },
        totalEntries: snapshot.size,
        verifiedEntries: verifiedCount
      };
    }
    
    // Recompute hash
    const bodyToHash = JSON.stringify({
      seq: entry.seq,
      ts: entry.ts,
      actor: entry.actor,
      role: entry.role,
      action: entry.action,
      sheetId: entry.sheetId,
      before: entry.before,
      after: entry.after,
      metadata: entry.metadata
    }) + entry.prevHash;
    
    const computedHash = calculateHash(bodyToHash);
    
    // Check if hash matches
    if (entry.hash !== computedHash) {
      return {
        status: 'INVALID',
        message: 'Hash mismatch: entry has been tampered with',
        failedEntry: {
          id: doc.id,
          seq: entry.seq,
          expectedHash: computedHash,
          actualHash: entry.hash,
          action: entry.action,
          actor: entry.actor
        },
        totalEntries: snapshot.size,
        verifiedEntries: verifiedCount
      };
    }
    
    // Move to next entry
    prevHash = entry.hash;
    verifiedCount++;
  }
  
  return {
    status: 'OK',
    message: 'All audit entries verified successfully',
    totalEntries: snapshot.size,
    verifiedEntries: verifiedCount,
    firstEntry: snapshot.docs[0].data().ts,
    lastEntry: snapshot.docs[snapshot.docs.length - 1].data().ts
  };
}

/**
 * Search audit log
 * 
 * @param {object} filters - Search filters
 * @param {string} filters.actor - Filter by actor UID
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.sheetId - Filter by sheet ID
 * @param {string} filters.startDate - Filter by start date (ISO)
 * @param {string} filters.endDate - Filter by end date (ISO)
 * @param {number} filters.limit - Max results (default 100)
 * @returns {Promise<array>} Array of audit entries
 */
async function search(filters = {}) {
  const db = getFirestore();
  let query = db.collection('audit').orderBy('seq', 'desc');
  
  // Apply filters
  if (filters.actor) {
    query = query.where('actor', '==', filters.actor);
  }
  
  if (filters.action) {
    query = query.where('action', '==', filters.action);
  }
  
  if (filters.sheetId) {
    query = query.where('sheetId', '==', filters.sheetId);
  }
  
  // Date filters (need to be applied after other filters due to Firestore limitations)
  if (filters.startDate) {
    query = query.where('ts', '>=', filters.startDate);
  }
  
  if (filters.endDate) {
    query = query.where('ts', '<=', filters.endDate);
  }
  
  // Limit
  const limit = filters.limit || 100;
  query = query.limit(limit);
  
  const snapshot = await query.get();
  
  const entries = [];
  snapshot.forEach(doc => {
    entries.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return entries;
}

/**
 * Get audit statistics
 * @returns {Promise<object>} Statistics
 */
async function getStatistics() {
  const db = getFirestore();
  
  const snapshot = await db.collection('audit').get();
  
  if (snapshot.empty) {
    return {
      totalEntries: 0,
      actionCounts: {},
      actorCounts: {},
      firstEntry: null,
      lastEntry: null
    };
  }
  
  const actionCounts = {};
  const actorCounts = {};
  let firstTs = null;
  let lastTs = null;
  
  snapshot.forEach(doc => {
    const entry = doc.data();
    
    // Count actions
    actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    
    // Count actors
    actorCounts[entry.actor] = (actorCounts[entry.actor] || 0) + 1;
    
    // Track timestamps
    if (!firstTs || entry.ts < firstTs) firstTs = entry.ts;
    if (!lastTs || entry.ts > lastTs) lastTs = entry.ts;
  });
  
  return {
    totalEntries: snapshot.size,
    actionCounts,
    actorCounts,
    firstEntry: firstTs,
    lastEntry: lastTs
  };
}

module.exports = {
  append,
  verify,
  search,
  getStatistics,
  // Export for testing
  calculateHash
};
