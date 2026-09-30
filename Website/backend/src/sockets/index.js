const { Server } = require('socket.io');
const { getAdmin } = require('../config/firebaseAdmin');
const { getFirestore, Collections } = require('../config/firestore');

/**
 * Socket.io room definitions
 */
const ROOMS = {
  CONTROLLER: 'controller',
  MODERATOR: 'moderator',
  examinerRoom: (uid) => `examiner:${uid}`
};

/**
 * Verify Firebase ID token from socket handshake
 * @param {string} token - Firebase ID token
 * @returns {Promise<object>} User data {uid, role, name, email}
 */
async function verifySocketToken(token) {
  try {
    const admin = getAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Load user profile from Firestore
    const db = getFirestore();
    const userDoc = await db.collection(Collections.USERS).doc(uid).get();
    
    if (!userDoc.exists) {
      throw new Error('User profile not found');
    }
    
    const userData = userDoc.data();
    
    // Validate role
    const validRoles = ['examiner', 'moderator', 'controller'];
    if (!userData.role || !validRoles.includes(userData.role)) {
      throw new Error('Invalid user role');
    }
    
    return {
      uid,
      role: userData.role,
      name: userData.name || decodedToken.name || 'Unknown User',
      email: decodedToken.email || userData.email
    };
  } catch (error) {
    console.error('[Socket Auth] Verification failed:', error.message);
    throw error;
  }
}

/**
 * Join user to appropriate rooms based on role
 * @param {Socket} socket - Socket.io socket instance
 * @param {object} user - User data {uid, role}
 */
function joinRoleRooms(socket, user) {
  const { role, uid } = user;
  
  switch (role) {
    case 'controller':
      socket.join(ROOMS.CONTROLLER);
      console.log(`[Socket] Controller ${uid} joined room: ${ROOMS.CONTROLLER}`);
      break;
      
    case 'moderator':
      socket.join(ROOMS.MODERATOR);
      console.log(`[Socket] Moderator ${uid} joined room: ${ROOMS.MODERATOR}`);
      break;
      
    case 'examiner':
      const examinerRoom = ROOMS.examinerRoom(uid);
      socket.join(examinerRoom);
      console.log(`[Socket] Examiner ${uid} joined room: ${examinerRoom}`);
      break;
  }
}

/**
 * Initialize Socket.io with authentication and room management
 * @param {http.Server} server - HTTP server instance
 * @param {object} corsOptions - CORS options
 * @returns {Server} Socket.io server instance
 */
function initializeSocket(server, corsOptions) {
  const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
  });
  
  // Authentication middleware: verify ID token in handshake
  io.use(async (socket, next) => {
    try {
      // Support token in handshake.auth, handshake.headers, or handshake.query
      const token = socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null) ||
        socket.handshake.query?.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
      // Verify token and load user data
      const user = await verifySocketToken(token);
      
      // Attach user data to socket
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('[Socket Auth] Authentication failed:', error.message);
      next(new Error('Authentication failed'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket) => {
    const { uid, role, name } = socket.user;
    
    console.log(`[Socket] User connected: ${name} (${role}, ${uid})`);
    
    // Join role-based rooms
    joinRoleRooms(socket, socket.user);
    
    // Send connection confirmation
    socket.emit('authenticated', {
      uid,
      role,
      name,
      timestamp: new Date().toISOString()
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${name} (${role}, ${uid})`);
    });
  });
  
  return io;
}

/**
 * Emit sheet_assigned event to specific examiner
 * @param {Server} io - Socket.io server instance
 * @param {string} examinerUid - Examiner's UID
 * @param {object} data - Sheet assignment data
 */
function emitSheetAssigned(io, examinerUid, data) {
  const room = ROOMS.examinerRoom(examinerUid);
  io.to(room).emit('sheet_assigned', {
    ...data,
    timestamp: new Date().toISOString()
  });
  console.log(`[Socket] Emitted sheet_assigned to ${room}`);
}

/**
 * Emit sheet_updated event to controller and moderator
 * @param {Server} io - Socket.io server instance
 * @param {object} data - Sheet update data
 */
function emitSheetUpdated(io, data) {
  io.to(ROOMS.CONTROLLER).emit('sheet_updated', {
    ...data,
    timestamp: new Date().toISOString()
  });
  
  io.to(ROOMS.MODERATOR).emit('sheet_updated', {
    ...data,
    timestamp: new Date().toISOString()
  });

  if (data.assignedTo) {
    io.to(ROOMS.examinerRoom(data.assignedTo)).emit('sheet_updated', {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log('[Socket] Emitted sheet_updated to controller, moderator, and assigned examiner');
}

/**
 * Emit anomaly_alert event to examiner, moderator, and controller
 * @param {Server} io - Socket.io server instance
 * @param {string} examinerUid - Examiner's UID (who marked the sheet)
 * @param {object} data - Alert data
 */
function emitAnomalyAlert(io, examinerUid, data) {
  // Send to examiner
  if (examinerUid) {
    io.to(ROOMS.examinerRoom(examinerUid)).emit('anomaly_alert', {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
  
  // Send to moderator
  io.to(ROOMS.MODERATOR).emit('anomaly_alert', {
    ...data,
    timestamp: new Date().toISOString()
  });
  
  // Send to controller
  io.to(ROOMS.CONTROLLER).emit('anomaly_alert', {
    ...data,
    timestamp: new Date().toISOString()
  });
  
  console.log('[Socket] Emitted anomaly_alert');
}

/**
 * Emit moderation_needed event to moderator
 * @param {Server} io - Socket.io server instance
 * @param {object} data - Moderation request data
 */
function emitModerationNeeded(io, data) {
  io.to(ROOMS.MODERATOR).emit('moderation_needed', {
    ...data,
    timestamp: new Date().toISOString()
  });
  console.log('[Socket] Emitted moderation_needed to moderator');
}

/**
 * Emit identity_check_failed event to controller
 * @param {Server} io - Socket.io server instance
 * @param {object} data - Identity check failure data
 */
function emitIdentityCheckFailed(io, data) {
  io.to(ROOMS.CONTROLLER).emit('identity_check_failed', {
    ...data,
    timestamp: new Date().toISOString()
  });
  console.log('[Socket] Emitted identity_check_failed to controller');
}

/**
 * Throttled dashboard tick emitter
 * Emits dashboard statistics at regular intervals
 */
class DashboardTicker {
  constructor(io, intervalMs = 5000) {
    this.io = io;
    this.intervalMs = intervalMs;
    this.interval = null;
    this.lastData = null;
  }
  
  start() {
    if (this.interval) return;
    
    this.interval = setInterval(() => {
      this.tick();
    }, this.intervalMs);
    
    console.log(`[Socket] Dashboard ticker started (${this.intervalMs}ms interval)`);
  }
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[Socket] Dashboard ticker stopped');
    }
  }
  
  async tick() {
    try {
      const db = getFirestore();
      
      // Gather dashboard statistics
      const stats = {
        total: 0,
        pending: 0,
        inProgress: 0,
        evaluated: 0,
        flagged: 0,
        final: 0,
        sheetsUploaded: 0,
        sheetsInProgress: 0,
        sheetsEvaluated: 0,
        sheetsFlagged: 0,
        alertsPending: 0,
        timestamp: new Date().toISOString()
      };
      
      // Count sheets by status
      const sheetsSnapshot = await db.collection(Collections.SHEETS).get();
      stats.total = sheetsSnapshot.size;
      sheetsSnapshot.forEach(doc => {
        const sheet = doc.data();
        switch (sheet.status) {
          case 'uploaded':
            stats.sheetsUploaded++;
            stats.pending++;
            break;
          case 'in_progress':
            stats.sheetsInProgress++;
            stats.inProgress++;
            break;
          case 'evaluated':
            stats.sheetsEvaluated++;
            stats.evaluated++;
            break;
          case 'flagged':
            stats.sheetsFlagged++;
            stats.flagged++;
            break;
          case 'final':
            stats.final++;
            break;
        }
      });
      
      // Count pending alerts
      const alertsSnapshot = await db.collection('alerts')
        .where('status', '==', 'pending')
        .get();
      stats.alertsPending = alertsSnapshot.size;
      
      // Only emit if data changed
      const statsString = JSON.stringify(stats);
      if (statsString !== this.lastData) {
        this.io.to(ROOMS.CONTROLLER).emit('dashboard_tick', stats);
        this.lastData = statsString;
      }
      
    } catch (error) {
      console.error('[Socket] Dashboard tick error:', error.message);
    }
  }
}

module.exports = {
  initializeSocket,
  emitSheetAssigned,
  emitSheetUpdated,
  emitAnomalyAlert,
  emitModerationNeeded,
  emitIdentityCheckFailed,
  DashboardTicker,
  ROOMS
};
