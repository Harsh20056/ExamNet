const admin = require('firebase-admin');

let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Reads FIREBASE_SERVICE_ACCOUNT from env (path to JSON file or JSON string)
 */
function initializeFirebaseAdmin() {
  if (initialized) {
    return admin;
  }

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT not configured. Auth will fail.');
      initialized = true;
      return admin;
    }

    let credential;

    // Try to parse as JSON string first
    if (serviceAccount.trim().startsWith('{')) {
      try {
        const serviceAccountObj = JSON.parse(serviceAccount);
        credential = admin.credential.cert(serviceAccountObj);
        console.log('[Firebase Admin] Initialized from JSON string');
      } catch (parseError) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT appears to be JSON but failed to parse: ' + parseError.message);
      }
    } else {
      // Treat as file path
      const fs = require('fs');
      const path = require('path');
      const absolutePath = path.resolve(serviceAccount);
      
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`FIREBASE_SERVICE_ACCOUNT file not found: ${absolutePath}`);
      }

      credential = admin.credential.cert(absolutePath);
      console.log('[Firebase Admin] Initialized from file:', absolutePath);
    }

    admin.initializeApp({
      credential: credential
    });

    initialized = true;
    console.log('[Firebase Admin] Successfully initialized');
    return admin;

  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error.message);
    throw error;
  }
}

/**
 * Get Firebase Admin instance (lazy initialization)
 */
function getAdmin() {
  if (!initialized) {
    initializeFirebaseAdmin();
  }
  return admin;
}

module.exports = {
  initializeFirebaseAdmin,
  getAdmin
};
