# Backend Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  (Frontend: React/Vite, Mobile Apps, Postman, etc.)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/WebSocket
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     Express Server (server.js)                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Security Middleware (Applied First)         │   │
│  │  • Helmet.js (Security Headers)                         │   │
│  │  • CORS (Dynamic Origin Validation)                     │   │
│  │  • Rate Limiter (100 req/15min per IP)                  │   │
│  │  • Body Parser (JSON/URLencoded, 50MB limit)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Route Handlers                         │   │
│  │                                                           │   │
│  │  Public Routes (No Auth):                               │   │
│  │  • GET /api/health                                       │   │
│  │                                                           │   │
│  │  Legacy Routes (No Auth Yet):                           │   │
│  │  • POST /api/send-otp                                    │   │
│  │  • POST /api/verify-otp                                  │   │
│  │  • GET/POST /api/students                               │   │
│  │  • GET/POST /api/active-center                          │   │
│  │  • POST /api/publish-exam-paper                         │   │
│  │  • POST /api/submit-exam                                │   │
│  │  • POST /api/cheat                                       │   │
│  │  • ... (all existing routes)                            │   │
│  │                                                           │   │
│  │  Future Protected Routes:                               │   │
│  │  • authenticate → requireRole(['role']) → handler        │   │
│  │  • validateRequest(schema) → handler                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Error Handling (Applied Last)                 │   │
│  │  • notFoundHandler (404 for unknown routes)             │   │
│  │  • errorHandler (Centralized error response)            │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
                             │
                             ▼
        ┌──────────────────────────────────────┐
        │    Socket.io (Real-time Events)      │
        │  • exam_paper_published               │
        │  • student_updated                    │
        │  • cheating_attempt                   │
        │  • broadcast_stats_updated            │
        └──────────────────────────────────────┘
```

---

## Request Flow - Authenticated Route (Future)

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ POST /api/students
     │ Authorization: Bearer <firebase-token>
     │ Body: { name, roll, seat }
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│                    Express Server                        │
│                                                          │
│  1. Security Middleware                                  │
│     ├─ Helmet (Security Headers)                        │
│     ├─ CORS Check (Origin validation)                   │
│     └─ Rate Limiter (Check IP quota)                    │
│                                                          │
│  2. authenticate Middleware                              │
│     ├─ Extract Bearer token                             │
│     ├─ Verify with Firebase Admin SDK                   │
│     ├─ Load user from Firestore (users/{uid})          │
│     ├─ Validate role (examiner|moderator|controller)    │
│     └─ Attach req.user = {uid, role, name, email}      │
│                                                          │
│  3. requireRole(['controller']) Middleware               │
│     ├─ Check req.user.role                              │
│     └─ Return 403 if not authorized                     │
│                                                          │
│  4. validateRequest(schema) Middleware                   │
│     ├─ Parse req.body with Zod schema                   │
│     ├─ Reject unknown fields (strict mode)              │
│     └─ Return 400 with errors if invalid                │
│                                                          │
│  5. Route Handler                                        │
│     ├─ Business logic (create student)                  │
│     ├─ Update in-memory database                        │
│     ├─ Emit Socket.io event                             │
│     └─ Return 201 response                              │
│                                                          │
│  6. Error Handler (if error thrown)                      │
│     └─ Return formatted error response                   │
└─────────────────────────────────────────────────────────┘
     │
     │ 201 Created
     │ { id, name, roll, seat, ... }
     │
     ▼
┌──────────┐
│  Client  │
└──────────┘
```

---

## Authentication Flow

```
┌────────────┐
│  Frontend  │
└──────┬─────┘
       │
       │ 1. User signs in with Firebase Auth
       │
       ▼
┌─────────────────┐
│  Firebase Auth  │  (Google, Email/Password, etc.)
└──────┬──────────┘
       │
       │ 2. Returns Firebase ID Token (JWT)
       │
       ▼
┌────────────┐
│  Frontend  │  Stores token (localStorage/context)
└──────┬─────┘
       │
       │ 3. Makes API request with token
       │    Authorization: Bearer <token>
       │
       ▼
┌────────────────────────────────────────┐
│         Backend: auth.js middleware    │
│                                         │
│  1. Extract token from header          │
│  2. Verify with Firebase Admin SDK     │
│     admin.auth().verifyIdToken(token)  │
│                                         │
│  3. Get uid from decoded token         │
│                                         │
│  4. Load user profile from Firestore   │
│     db.collection('users').doc(uid)    │
│                                         │
│  5. Validate role field                │
│     role ∈ {examiner,moderator,        │
│              controller}                │
│                                         │
│  6. Attach to request:                 │
│     req.user = {uid, role, name}      │
└────────────┬───────────────────────────┘
             │
             │ Success → next()
             │
             ▼
       ┌────────────┐
       │   Handler  │
       └────────────┘
```

---

## Role-Based Access Control

```
Roles Hierarchy:

┌──────────────────────────────────────────────────────────┐
│                      controller                           │
│  • Full system access                                    │
│  • Exam setup and configuration                          │
│  • User management                                       │
│  • Center management                                     │
│  • View all analytics                                    │
└──────────────────────────────────────────────────────────┘
                            │
                            │ has permissions of:
                            │
┌──────────────────────────▼───────────────────────────────┐
│                      moderator                            │
│  • Review marked papers                                  │
│  • Approve/reject grades                                 │
│  • Handle flagged submissions                            │
│  • Quality control                                       │
└──────────────────────────────────────────────────────────┘
                            │
                            │ has permissions of:
                            │
┌──────────────────────────▼───────────────────────────────┐
│                      examiner                             │
│  • Mark/grade papers                                     │
│  • View assigned submissions                             │
│  • Submit grades                                         │
│  • View rubrics                                          │
└──────────────────────────────────────────────────────────┘


Usage in Code:

// Only controllers
requireRole(['controller'])

// Examiners and moderators
requireRole(['examiner', 'moderator'])

// All authenticated users
requireRole(['examiner', 'moderator', 'controller'])
```

---

## Validation Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ POST /api/students
     │ Body: { name: "John", roll: "001", seat: "A1", extra: "field" }
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│            validateRequest(schema) Middleware            │
│                                                          │
│  Schema Definition:                                      │
│  ┌────────────────────────────────────────────┐        │
│  │ z.object({                                  │        │
│  │   name: z.string().min(1).max(100),        │        │
│  │   roll: z.string().min(1).max(20),         │        │
│  │   seat: z.string().min(1).max(10)          │        │
│  │ }).strict()  // ← Rejects unknown fields   │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Validation Result:                                      │
│  ✗ Error: Unknown key "extra"                           │
│                                                          │
│  Response:                                               │
│  ┌────────────────────────────────────────────┐        │
│  │ 400 Bad Request                             │        │
│  │ {                                            │        │
│  │   error: "Validation failed",               │        │
│  │   details: [{                                │        │
│  │     field: "extra",                          │        │
│  │     message: "Unrecognized key(s)",         │        │
│  │     code: "unrecognized_keys"               │        │
│  │   }]                                         │        │
│  │ }                                            │        │
│  └────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
     │
     │ 400 Bad Request
     │
     ▼
┌──────────┐
│  Client  │  Displays validation errors to user
└──────────┘
```

---

## Data Storage (Current: In-Memory)

```
┌────────────────────────────────────────────────────────────┐
│                   In-Memory Storage                         │
│                   (Defined in server.js)                    │
│                                                             │
│  students: Array<Student>                                  │
│  ├─ id: number                                             │
│  ├─ name: string                                           │
│  ├─ roll: string                                           │
│  ├─ seat: string                                           │
│  ├─ centerId: number                                       │
│  ├─ status: 'pending' | 'verified' | 'submitted'          │
│  ├─ intent: 'BLOCKED' | 'UNRESOLVED' | 'PARTIAL' |        │
│  │          'COMPLETE'                                     │
│  ├─ intentStatus: {status, reason, updatedAt, metadata}   │
│  ├─ answers: string[]                                      │
│  ├─ score: number                                          │
│  └─ referenceDescriptor: string (face encoding)           │
│                                                             │
│  activeExamPaper: Object | null                            │
│  ├─ id: number                                             │
│  ├─ title: string                                          │
│  ├─ subject: string                                        │
│  ├─ pdfDataUrl: string (base64)                           │
│  ├─ questions: Question[]                                  │
│  ├─ answerKey: string[]                                    │
│  ├─ startTime: number                                      │
│  └─ durationSeconds: number                                │
│                                                             │
│  otps: Map<email, {otp, expires}>                         │
│  broadcastReceipts: Map<roll, {socketId, roll, name}>     │
│  activeCenterId: number                                    │
│  nextId: number (auto-increment)                          │
└────────────────────────────────────────────────────────────┘

⚠️  Data is lost on server restart
✅  Future: Migrate to PostgreSQL/MongoDB for persistence
```

---

## Future Architecture (With Database)

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│                  Express Server                         │
│                                                         │
│  Routes → Services → Database                          │
│                                                         │
│  src/routes/students.js                                │
│       │                                                 │
│       ▼                                                 │
│  src/services/studentService.js                        │
│       │                                                 │
│       ▼                                                 │
│  src/models/Student.js (ORM/ODM)                      │
│       │                                                 │
│       ▼                                                 │
└───────┼─────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  PostgreSQL / MongoDB    │
│                          │
│  Tables/Collections:     │
│  • users                 │
│  • students              │
│  • exams                 │
│  • submissions           │
│  • audit_logs            │
└──────────────────────────┘
```

---

## Configuration Management

```
┌────────────────────────────────────────────────────────────┐
│                    Environment Variables                    │
│                         (.env file)                         │
│                                                             │
│  Development:                                              │
│  ├─ FIREBASE_SERVICE_ACCOUNT=/path/to/key.json           │
│  ├─ CORS_ORIGIN=http://localhost:3000                     │
│  └─ NODE_ENV=development                                   │
│                                                             │
│  Production:                                               │
│  ├─ FIREBASE_SERVICE_ACCOUNT={"type":"service_account"..} │
│  ├─ CORS_ORIGIN=https://app.vercel.app,https://app.com   │
│  └─ NODE_ENV=production                                    │
└────────────────────────────────────────────────────────────┘
                             │
                             │ Loaded by dotenv
                             ▼
┌────────────────────────────────────────────────────────────┐
│                   Configuration Modules                     │
│                                                             │
│  src/config/firebaseAdmin.js                               │
│  ├─ Initializes Firebase Admin SDK                        │
│  ├─ Supports file path or JSON string                     │
│  └─ Exports getAdmin() function                           │
│                                                             │
│  src/config/cors.js                                        │
│  ├─ Parses CORS_ORIGIN (comma-separated)                  │
│  ├─ Creates origin validator function                     │
│  └─ Exports corsOptions for Express & Socket.io          │
└────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
Any Error in Route Handler
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│           Error Handling Middleware                      │
│           (errorHandler in server.js)                    │
│                                                          │
│  1. Log error details:                                   │
│     • Error message                                      │
│     • Stack trace                                        │
│     • Request path & method                              │
│     • Timestamp (ISO/UTC)                                │
│                                                          │
│  2. Determine status code:                               │
│     • err.status or err.statusCode                       │
│     • Default: 500                                       │
│                                                          │
│  3. Format response:                                     │
│     {                                                    │
│       error: err.name || 'Error',                        │
│       message: err.message,                              │
│       stack: (dev only)                                  │
│     }                                                    │
│                                                          │
│  4. Send response                                        │
└─────────────────────────────────────────────────────────┘
         │
         ▼
   Client receives error


Special Cases:

Validation Error (Zod)          → 400 Bad Request
Authentication Error            → 401 Unauthorized
Authorization Error (Role)      → 403 Forbidden
Not Found                       → 404 Not Found
Rate Limit Exceeded             → 429 Too Many Requests
Internal Server Error           → 500 Internal Server Error
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        Security Layers                       │
│                      (Applied in Order)                      │
│                                                              │
│  1. Network Layer                                           │
│     ├─ HTTPS/TLS (Production)                              │
│     └─ Firewall rules                                       │
│                                                              │
│  2. Headers (Helmet.js)                                     │
│     ├─ X-Content-Type-Options: nosniff                     │
│     ├─ X-Frame-Options: SAMEORIGIN                         │
│     ├─ Strict-Transport-Security                           │
│     └─ Cross-Origin policies                               │
│                                                              │
│  3. CORS (Dynamic)                                          │
│     ├─ Origin validation                                    │
│     ├─ Credentials support                                  │
│     └─ Method restrictions                                  │
│                                                              │
│  4. Rate Limiting                                           │
│     ├─ IP-based quotas                                      │
│     ├─ Time windows                                         │
│     └─ Custom limits per route (future)                    │
│                                                              │
│  5. Authentication (Firebase)                               │
│     ├─ JWT token verification                               │
│     ├─ Token expiration check                               │
│     └─ User existence validation                            │
│                                                              │
│  6. Authorization (RBAC)                                    │
│     ├─ Role verification                                    │
│     └─ Permission checks                                    │
│                                                              │
│  7. Input Validation (Zod)                                  │
│     ├─ Schema validation                                    │
│     ├─ Type checking                                        │
│     ├─ Range validation                                     │
│     └─ Unknown field rejection                              │
│                                                              │
│  8. Business Logic                                          │
│     ├─ Resource ownership checks                            │
│     ├─ State validation                                     │
│     └─ Operation permissions                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Development vs Production

```
┌───────────────────────────────────────────────────────────┐
│                     Development Mode                       │
│                  NODE_ENV=development                      │
│                                                            │
│  • CORS: Wildcard (*) accepted                            │
│  • Errors: Full stack traces                              │
│  • Logs: Verbose console output                           │
│  • Firebase: Optional (simulated auth)                    │
│  • Rate Limits: Relaxed                                   │
│  • SMTP: Simulated (OTP in console)                       │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│                     Production Mode                        │
│                  NODE_ENV=production                       │
│                                                            │
│  • CORS: Strict origin whitelist                          │
│  • Errors: Minimal error details                          │
│  • Logs: Structured logging service                       │
│  • Firebase: Required                                      │
│  • Rate Limits: Enforced strictly                         │
│  • SMTP: Real email delivery                              │
│  • HTTPS: Required                                         │
│  • Monitoring: APM, error tracking                        │
└───────────────────────────────────────────────────────────┘
```

---

This architecture provides a solid foundation for scaling, maintaining, and securing the SAMADHAN X backend system.
