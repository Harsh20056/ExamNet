const { getAdmin } = require('../config/firebaseAdmin');

/**
 * Authentication Middleware
 * Verifies Firebase JWT token and loads user role from Firestore
 * Attaches req.user = { uid, role, name } on success
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the Firebase ID token
    const admin = getAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Load user profile from Firestore
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User profile not found in database' 
      });
    }

    const userData = userDoc.data();
    const role = userData.role;
    const name = userData.name || userData.displayName || decodedToken.name || 'Unknown User';

    // Validate role
    const validRoles = ['examiner', 'moderator', 'controller'];
    if (!role || !validRoles.includes(role)) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: `Invalid or missing role. Must be one of: ${validRoles.join(', ')}` 
      });
    }

    // Attach user to request
    req.user = {
      uid,
      role,
      name,
      email: decodedToken.email || userData.email
    };

    next();

  } catch (error) {
    console.error('[Auth] Token verification failed:', error.message);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Token expired. Please sign in again.' 
      });
    }

    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid token format' 
      });
    }

    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Token verification failed' 
    });
  }
}

module.exports = authenticate;
