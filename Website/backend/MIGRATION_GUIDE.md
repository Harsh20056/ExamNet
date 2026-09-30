# Backend Foundation Migration Guide

## ✅ What's Been Implemented

### 1. New Foundation Structure
```
Website/backend/
├── src/
│   ├── config/
│   │   ├── firebaseAdmin.js      ✅ Firebase Admin SDK initialization
│   │   └── cors.js                ✅ Dynamic CORS configuration
│   ├── middleware/
│   │   ├── auth.js                ✅ JWT token verification + role loading
│   │   ├── requireRole.js         ✅ Role-based authorization
│   │   ├── validation.js          ✅ Zod request validation
│   │   └── errorHandler.js        ✅ Centralized error handling
│   ├── routes/
│   │   └── health.js              ✅ Health check endpoint
│   └── README.md                  ✅ Documentation
├── server.js                      ✅ Updated with new foundation
├── .env.example                   ✅ Complete environment template
└── .gitignore                     ✅ Updated to protect secrets
```

### 2. Security Enhancements
- ✅ **Helmet.js** - Security headers enabled
- ✅ **Rate Limiting** - 100 requests per 15 minutes per IP
- ✅ **Dynamic CORS** - Configured from `CORS_ORIGIN` env variable
- ✅ **Firebase Auth** - JWT token verification with Firestore role loading
- ✅ **Zod Validation** - Strict request body validation

### 3. New Dependencies Installed
```json
{
  "firebase-admin": "^12.x",
  "helmet": "^8.x",
  "express-rate-limit": "^7.x",
  "zod": "^3.x",
  "multer": "^1.x"
}
```

### 4. Environment Variables Added
See `.env.example` for complete configuration. Key additions:
- `FIREBASE_SERVICE_ACCOUNT` - Firebase Admin SDK credentials
- `CORS_ORIGIN` - Comma-separated allowed origins
- `AI_API_KEY`, `AI_MODEL`, `USE_CACHED_AI` - AI service config
- `NODE_ENV` - Environment indicator

### 5. API Endpoints Status

#### New Protected Routes (Ready to Use)
- ✅ `GET /api/health` - No auth required, test deployment

#### Existing Legacy Routes (Unchanged)
All existing routes still work exactly as before:
- ✅ `POST /api/send-otp`
- ✅ `POST /api/verify-otp`
- ✅ `GET /api/active-center`
- ✅ `POST /api/active-center`
- ✅ `GET /api/students`
- ✅ `POST /api/students`
- ✅ `PUT /api/students/:id/status`
- ✅ `PUT /api/students/:id`
- ✅ `PUT /api/students/roll/:roll`
- ✅ `DELETE /api/students/:id`
- ✅ `POST /api/cheat`
- ✅ `GET /api/active-exam-paper`
- ✅ `GET /api/broadcast-stats`
- ✅ `POST /api/publish-exam-paper`
- ✅ `POST /api/reset-exam-paper`
- ✅ `POST /api/submit-exam`

#### Socket.io Events (Unchanged)
All Socket.io events continue to work:
- ✅ All server → client broadcasts
- ✅ All client → server events

---

## 🚀 Quick Start

### 1. Update Environment Variables

Edit your `.env` file:

```bash
# Copy from example
cp .env.example .env

# Edit with your values
nano .env
```

Required for production:
```env
PORT=5000
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
CORS_ORIGIN=https://your-frontend.vercel.app
```

### 2. Test Locally

```bash
# Start server
npm start

# Test health check
curl http://localhost:5000/api/health

# Should return:
# {"status":"ok","timestamp":"...","service":"SAMADHAN X Backend"}
```

### 3. Verify Existing Routes Work

```bash
# Test students endpoint
curl http://localhost:5000/api/students

# Should return: []
```

---

## 📋 Next Steps (Recommended Order)

### Phase 1: Authentication Setup (Required for Protected Routes)

#### Step 1.1: Set Up Firebase
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create or select your project
3. Enable Firestore Database
4. Go to Project Settings → Service Accounts
5. Click "Generate New Private Key"
6. Save the JSON file

#### Step 1.2: Configure Environment
```bash
# Local development (file path)
FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccountKey.json

# Production (JSON string)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'
```

#### Step 1.3: Seed User Data in Firestore
Create users in Firestore with this structure:

```
Collection: users
Document ID: <firebase-uid>
Fields:
  - role: "examiner" | "moderator" | "controller"
  - name: string
  - email: string
  - createdAt: timestamp
```

Example script (run in Firebase Console):
```javascript
// Add an examiner user
db.collection('users').doc('user-uid-here').set({
  role: 'examiner',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date().toISOString()
});
```

### Phase 2: Migrate Routes to Use Authentication

#### Step 2.1: Protect Student Routes
```javascript
// In server.js or new route file
const authenticate = require('./src/middleware/auth');
const requireRole = require('./src/middleware/requireRole');

// Example: Only controllers can create students
app.post('/api/students',
  authenticate,
  requireRole(['controller']),
  (req, res) => {
    // Existing logic...
  }
);
```

#### Step 2.2: Add Validation
```javascript
const { z } = require('zod');
const { validateRequest } = require('./src/middleware/validation');

const createStudentSchema = z.object({
  name: z.string().min(1).max(100),
  roll: z.string().min(1).max(20),
  seat: z.string().min(1).max(10)
}).strict();

app.post('/api/students',
  authenticate,
  requireRole(['controller']),
  validateRequest(createStudentSchema),
  (req, res) => {
    // req.body is now validated
  }
);
```

### Phase 3: Extract Business Logic to Services

Create `src/services/studentService.js`:
```javascript
const { students, nextId, activeCenterId } = require('../config/database');

function createStudent(data) {
  const newStudent = {
    id: nextId++,
    ...data,
    centerId: activeCenterId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  students.push(newStudent);
  return newStudent;
}

module.exports = { createStudent };
```

Use in routes:
```javascript
const studentService = require('../services/studentService');

app.post('/api/students', async (req, res) => {
  const student = studentService.createStudent(req.body);
  io.emit('student_added', student);
  res.status(201).json(student);
});
```

### Phase 4: Organize Routes into Modules

Create `src/routes/students.js`:
```javascript
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

router.get('/', authenticate, (req, res) => {
  // Get all students
});

router.post('/', 
  authenticate, 
  requireRole(['controller']), 
  (req, res) => {
    // Create student
  }
);

module.exports = router;
```

Mount in `server.js`:
```javascript
const studentsRouter = require('./src/routes/students');
app.use('/api/students', studentsRouter);
```

### Phase 5: Migrate Socket.io Handlers

Create `src/sockets/handlers.js`:
```javascript
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('paper_received_ack', (data) => {
      // Handle acknowledgment
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = setupSocketHandlers;
```

Use in `server.js`:
```javascript
const setupSocketHandlers = require('./src/sockets/handlers');
setupSocketHandlers(io);
```

### Phase 6: Add Database Persistence

Replace in-memory storage with PostgreSQL or MongoDB:

1. Install database driver:
```bash
npm install pg  # PostgreSQL
# or
npm install mongodb  # MongoDB
```

2. Create `src/config/database.js`
3. Migrate data structures to database schemas
4. Update service layer to use database queries
5. Add migrations for schema changes

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production` in environment
- [ ] Configure `CORS_ORIGIN` with actual frontend URLs (remove `*`)
- [ ] Store `FIREBASE_SERVICE_ACCOUNT` as environment variable (not file)
- [ ] Rotate all API keys (`AI_API_KEY`, `SMTP_PASS`)
- [ ] Enable HTTPS (SSL/TLS certificates)
- [ ] Review rate limits for production traffic
- [ ] Set up error logging service (Sentry, LogRocket)
- [ ] Add monitoring (uptime, performance)
- [ ] Implement request logging
- [ ] Set up automated backups (when database added)
- [ ] Review and test CORS configuration
- [ ] Enable audit logging for sensitive operations
- [ ] Add API documentation (Swagger/OpenAPI)

---

## 🧪 Testing

### Manual Testing

```bash
# Health check (no auth)
curl http://localhost:5000/api/health

# Test protected route (with auth)
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     http://localhost:5000/api/protected

# Test validation error
curl -X POST http://localhost:5000/api/students \
     -H "Content-Type: application/json" \
     -d '{"invalid":"field"}'
# Should return 400 with validation errors

# Test CORS
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://localhost:5000/api/students
```

### Frontend Integration

Update your frontend to send Firebase ID tokens:

```javascript
// Get Firebase token
const token = await firebase.auth().currentUser.getIdToken();

// Make authenticated request
const response = await fetch('http://localhost:5000/api/students', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 🐛 Troubleshooting

### Firebase Admin Errors

**Problem**: `FIREBASE_SERVICE_ACCOUNT not configured`
- **Solution**: Set the environment variable in `.env`

**Problem**: `auth/id-token-expired`
- **Solution**: Token expired, frontend needs to refresh the token

**Problem**: `User profile not found in database`
- **Solution**: User exists in Firebase Auth but not in Firestore. Add user document.

### CORS Errors

**Problem**: `Not allowed by CORS`
- **Solution**: Add your frontend URL to `CORS_ORIGIN` in `.env`
- Format: `CORS_ORIGIN=http://localhost:3000,https://app.vercel.app`

**Problem**: Preflight request fails
- **Solution**: Ensure CORS middleware is before routes
- Check browser console for exact error

### Rate Limit Issues

**Problem**: `429 Too Many Requests`
- **Solution**: Adjust rate limit in `server.js` or wait for window to reset
- Default: 100 requests per 15 minutes per IP

### Validation Errors

**Problem**: `Validation failed: unknown keys`
- **Solution**: Zod uses strict mode - remove unknown fields from request
- Only send fields defined in the schema

---

## 📚 Additional Resources

- [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
- [Zod Schema Validation](https://zod.dev/)
- [Helmet.js Security](https://helmetjs.github.io/)
- [Express Rate Limiting](https://express-rate-limit.mintlify.app/)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

## 🎯 Migration Status

**Current State**: ✅ Foundation Complete
- Backend foundation is ready
- Existing routes still work
- New routes can use authentication
- Security middleware active

**Next Milestone**: 🔄 Migrate one route to use auth + validation
**Future Milestone**: 🔄 Full migration with database persistence

---

## 💬 Support

If you encounter issues during migration:
1. Check the logs for error details
2. Review `src/README.md` for middleware usage
3. Test with the health endpoint first
4. Verify environment variables are set correctly
5. Check Firebase console for auth issues

Happy migrating! 🚀
