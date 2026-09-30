const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

let initialized = false;

// Ensure backward compatibility for admin.firestore() and admin.auth()
if (typeof admin.firestore !== 'function') {
  admin.firestore = function(app) {
    return getFirestore(app);
  };
}
if (typeof admin.auth !== 'function') {
  admin.auth = function(app) {
    return getAuth(app);
  };
}

/**
 * Initialize Firebase Admin SDK
 * Priority:
 * 1. Use FIREBASE_SERVICE_ACCOUNT_JSON if present (JSON.parse, fix "\\n" in private_key)
 * 2. Else read the file at FIREBASE_SERVICE_ACCOUNT
 * 3. Throw a clear startup error if neither works
 */
function initializeFirebaseAdmin() {
  if (initialized) {
    return admin;
  }

  try {
    const certFn = (admin.credential && admin.credential.cert) || admin.cert;
    let credential;
    let projectId = process.env.FIREBASE_PROJECT_ID;

    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (rawJson && rawJson.trim().length > 0) {
      try {
        const serviceAccountObj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        // Fix escaped newlines in private key
        if (serviceAccountObj.private_key) {
          serviceAccountObj.private_key = serviceAccountObj.private_key.replace(/\\n/g, '\n');
        }
        if (!projectId && serviceAccountObj.project_id) {
          projectId = serviceAccountObj.project_id;
        }
        credential = certFn(serviceAccountObj);
        console.log('[Firebase Admin] Initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      } catch (parseError) {
        throw new Error(
          `Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${parseError.message}. Make sure it is valid JSON with properly escaped newlines.`
        );
      }
    } else if (filePath && filePath.trim().length > 0) {
      const absolutePath = path.resolve(filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(
          `FIREBASE_SERVICE_ACCOUNT file not found at: ${absolutePath}. Check your .env file or provide FIREBASE_SERVICE_ACCOUNT_JSON.`
        );
      }
      try {
        const fileContent = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        if (fileContent.private_key) {
          fileContent.private_key = fileContent.private_key.replace(/\\n/g, '\n');
        }
        if (!projectId && fileContent.project_id) {
          projectId = fileContent.project_id;
        }
        credential = certFn(fileContent);
        console.log('[Firebase Admin] Initialized from file:', absolutePath);
      } catch (readErr) {
        throw new Error(
          `Failed to parse service account file at ${absolutePath}: ${readErr.message}`
        );
      }
    } else {
      throw new Error(
        'Neither FIREBASE_SERVICE_ACCOUNT_JSON nor FIREBASE_SERVICE_ACCOUNT is configured. Firebase Admin cannot initialize without credentials.'
      );
    }

    if (admin.getApps().length === 0) {
      admin.initializeApp({
        credential,
        projectId: projectId || 'samadhanexam'
      });
    }

    initialized = true;
    console.log(`[Firebase Admin] Successfully initialized (Project: ${projectId || 'default'})`);
    return admin;

  } catch (error) {
    console.error('\n❌ [Firebase Admin Startup Error]:', error.message, '\n');
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
