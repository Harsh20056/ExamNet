# Firestore Implementation Summary

## ✅ Implementation Complete

A complete Firestore-backed exam management system with authentication, role-based access control, and anonymized answer sheet handling.

---

## 📁 New Files Created

### Configuration
- `src/config/firestore.js` - Firestore database connection and constants
- `src/config/firebaseAdmin.js` - Firebase Admin SDK initialization *(from foundation)*
- `src/config/cors.js` - CORS configuration *(from foundation)*

### Services (Business Logic)
- `src/services/examService.js` - Exam CRUD operations
- `src/services/sheetService.js` - Sheet management, marking, and anonymization

### Routes (API Endpoints)
- `src/routes/exams.js` - Exam management endpoints
- `src/routes/sheets.js` - Sheet upload, marking, and submission endpoints
- `src/routes/health.js` - Health check endpoint *(from foundation)*

### Validation Schemas
- `src/schemas/exam.schemas.js` - Zod schemas for exam validation
- `src/schemas/sheet.schemas.js` - Zod schemas for sheet operations

### Middleware *(from foundation)*
- `src/middleware/auth.js` - Firebase JWT verification + role loading
- `src/middleware/requireRole.js` - Role-based authorization
- `src/middleware/validation.js` - Zod request validation
- `src/middleware/errorHandler.js` - Centralized error handling

### Utilities
- `src/utils/timestamp.js` - ISO/UTC timestamp helpers
- `src/utils/responses.js` - Standard API response utilities

### Seed Data
- `src/seed/seed.js` - Demo data creation script
- `src/seed/README.md` - Seed documentation

### Documentation
- `API_DOCUMENTATION.md` - Complete API reference
- `DEMO_CREDENTIALS.md` - Demo login credentials
- `FIRESTORE_IMPLEMENTATION.md` - This file
- `FOUNDATION_SUMMARY.md` - Backend foundation overview *(from foundation)*
- `MIGRATION_GUIDE.md` - Migration instructions *(from foundation)*
- `ARCHITECTURE.md` - System architecture diagrams *(from foundation)*

---

## 🗄️ Firestore Collections

### 1. **exams**
Stores exam definitions with questions, rubrics, and model answers.

```javascript
{
  id: "auto-generated",
  title: "Computer Science Midterm 2026",
  subject: "Computer Science",
  examDate: "2026-10-15T09:00:00.000Z",
  duration: 180, // minutes
  instructions: "Answer all questions...",
  questions: [
    {
      qNo: 1,
      maxMarks: 10,
      text: "Question text...",
      modelAnswer: "Model answer...",
      rubric: [
        {
          criterion: "Criterion name",
          points: 3,
          description: "Description..."
        }
      ]
    }
  ],
  createdBy: "user-uid",
  createdAt: "2026-09-29T12:00:00.000Z",
  updatedAt: "2026-09-29T12:00:00.000Z"
}
```

### 2. **sheets**
Stores anonymized answer sheets (NO student identity).

```javascript
{
  id: "auto-generated",
  sheetId: "SHEET-a1b2c3d4e5", // Anonymized ID
  examId: "exam-id",
  pages: [
    {
      pageNumber: 1,
      fileName: "page1.jpg",
      mimeType: "image/jpeg",
      size: 245678,
      dataUrl: "data:image/jpeg;base64,..."
    }
  ],
  status: "uploaded" | "in_progress" | "evaluated" | "flagged" | "verified",
  assignedTo: "examiner-uid",
  uploadedBy: "controller-uid",
  uploadedAt: "2026-09-29T10:00:00.000Z",
  startedAt: "2026-09-29T11:00:00.000Z",
  completedAt: "2026-09-29T12:00:00.000Z",
  totalMarks: 85,
  maxMarks: 100,
  updatedAt: "2026-09-29T12:00:00.000Z"
}
```

### 3. **identityMap**
Separate collection mapping anonymized sheet IDs to student identity.
**NEVER exposed via API.**

```javascript
{
  id: "auto-generated",
  sheetId: "SHEET-a1b2c3d4e5",
  rollNo: "CS2026001",
  studentName: "Arjun Kumar",
  createdAt: "2026-09-29T10:00:00.000Z"
}
```

### 4. **marks**
Individual question marks for each sheet.

```javascript
{
  id: "sheet-id_q1", // Composite key: sheetId_qNo
  sheetId: "sheet-doc-id",
  qNo: 1,
  marks: 8,
  comment: "Good explanation but missing examples",
  timeSpentSec: 120,
  markedBy: "examiner-uid",
  markedAt: "2026-09-29T11:15:00.000Z"
}
```

### 5. **users** *(from foundation)*
User profiles with roles.

```javascript
{
  id: "firebase-uid",
  email: "examiner1@demo.com",
  name: "Examiner One",
  role: "examiner" | "moderator" | "controller",
  createdAt: "2026-09-29T08:00:00.000Z",
  updatedAt: "2026-09-29T08:00:00.000Z"
}
```

---

## 🛣️ API Endpoints

### Exam Management

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/exams` | controller | Create exam |
| GET | `/api/exams` | all | List all exams |
| GET | `/api/exams/:id` | all | Get exam details |

### Sheet Management

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/sheets/upload` | controller | Upload answer sheets |
| GET | `/api/sheets` | controller | List all sheets (with filters) |
| GET | `/api/sheets/mine` | examiner | List assigned sheets |
| GET | `/api/sheets/:id` | role-based | Get sheet details |
| POST | `/api/sheets/:id/start` | role-based | Start marking |
| PUT | `/api/sheets/:id/marks/:qNo` | role-based | Save question marks |
| POST | `/api/sheets/:id/submit` | role-based | Submit sheet |

### Health Check

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| GET | `/api/health` | public | Server health check |

---

## 🔐 Security Features

### Authentication
- ✅ Firebase ID token verification
- ✅ User profile loading from Firestore
- ✅ Role validation (examiner, moderator, controller)
- ✅ Token expiration handling

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ Examiner can only access assigned sheets
- ✅ Moderator can access all sheets
- ✅ Controller has full system access

### Privacy Protection
- ✅ Student identity stored separately in `identityMap`
- ✅ Anonymized sheet IDs (`SHEET-xxxxxxx`)
- ✅ Identity NEVER exposed via API
- ✅ Only controllers can access identity mapping (Firestore direct)

### Data Validation
- ✅ Zod schemas with strict mode
- ✅ Unknown field rejection
- ✅ Type validation
- ✅ Range validation (marks <= maxMarks)

### Server-Side Calculation
- ✅ Total marks calculated on server
- ✅ Client-provided totals rejected
- ✅ Automatic recalculation on mark changes

### Status Control
- ✅ Status changes only via specific endpoints
- ✅ No free-form status updates
- ✅ Controlled workflow: uploaded → in_progress → evaluated

---

## 📊 Demo Data

### Created by `npm run seed`

#### Users (7)
- 5 examiners: `examiner1@demo.com` to `examiner5@demo.com`
- 1 moderator: `moderator@demo.com`
- 1 controller: `controller@demo.com`
- **Password:** `Demo123!` (all users)

#### Exam (1)
- **Title:** Computer Science Midterm Examination 2026
- **Questions:** 8 (100 marks total)
- **Languages:** English + Hindi
- **Topics:** OOP, algorithms, databases, networking, SQL

#### Answer Sheets (20)
- **Status distribution:**
  - Uploaded: 2 (10%)
  - In Progress: 13 (65%)
  - Evaluated: 5 (25%)
- **Assignment:** Round-robin across 5 examiners
- **Identity:** Fake student names only

#### Planted Test Cases
- Sheet #11: Has unmarked question (Q3)
- Sheets #1-2: Uploaded status (unassigned)

---

## 🚀 Getting Started

### 1. Prerequisites

```bash
# Firebase Admin SDK configured
FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccountKey.json

# Or JSON string for deployment
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 2. Install Dependencies

```bash
cd Website/backend
npm install
```

Dependencies added:
- `firebase-admin` - Firebase Admin SDK
- `nanoid@3` - Anonymized ID generation
- `multer` - File upload handling
- `helmet` - Security headers *(foundation)*
- `express-rate-limit` - Rate limiting *(foundation)*
- `zod` - Schema validation *(foundation)*

### 3. Seed Demo Data

```bash
npm run seed
```

This creates users in Firebase Auth + Firestore, exams, and answer sheets.

### 4. Start Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

### 5. Test API

```bash
# Health check (no auth)
curl http://localhost:5000/api/health

# Get exams (requires auth)
curl http://localhost:5000/api/exams \
  -H "Authorization: Bearer <firebase-token>"
```

---

## 📝 Key Design Decisions

### 1. **Anonymization Strategy**
- Generate unique `SHEET-xxxxxxx` IDs using nanoid
- Store identity mapping in separate collection
- Never expose identity via API routes
- Only controllers can access mapping (via Firestore direct)

### 2. **Server-Side Totals**
- Total marks calculated on server only
- Client cannot manipulate totals
- Recalculated on every mark update
- Ensures data integrity

### 3. **Status Workflow**
- Controlled state transitions
- No free-form status updates
- Specific endpoints for each transition
- Enforces proper workflow

### 4. **Access Control**
- Examiner: assigned sheets only
- Moderator: all sheets
- Controller: full access + exam creation + upload
- Enforced at middleware level

### 5. **Validation**
- Zod schemas with strict mode
- Reject unknown fields
- Server-side range checks (marks <= maxMarks)
- Type safety throughout

### 6. **Timestamps**
- All timestamps in ISO 8601 (UTC)
- Server-generated only
- Consistent format across system

---

## 🔄 Workflow Examples

### Examiner Workflow

1. **Login** with `examiner1@demo.com`
2. **Get assigned sheets**: `GET /api/sheets/mine`
3. **View sheet details**: `GET /api/sheets/:id`
4. **Start marking**: `POST /api/sheets/:id/start`
5. **Mark questions**: `PUT /api/sheets/:id/marks/:qNo`
6. **Submit**: `POST /api/sheets/:id/submit`

### Controller Workflow

1. **Login** with `controller@demo.com`
2. **Create exam**: `POST /api/exams`
3. **Upload sheets**: `POST /api/sheets/upload` (with files)
4. **Assign sheets**: Update `assignedTo` in Firestore
5. **Monitor progress**: `GET /api/sheets?status=in_progress`

### Moderator Workflow

1. **Login** with `moderator@demo.com`
2. **View evaluated sheets**: `GET /api/sheets?status=evaluated`
3. **Review any sheet**: `GET /api/sheets/:id`
4. **Revise marks if needed**: `PUT /api/sheets/:id/marks/:qNo`
5. **Verify**: Update status to `verified`

---

## ⚠️ Breaking Changes from Legacy

### Deprecated Routes

The following routes are **deprecated** and will be removed:

- `GET /api/students` → Use `GET /api/sheets`
- `POST /api/students` → Use `POST /api/sheets/upload`
- `PUT /api/students/:id` → Use sheet marking routes
- `DELETE /api/students/:id` → Not applicable
- `POST /api/cheat` → Use anomaly detection (coming soon)

### Migration Notes

1. **In-memory storage** → **Firestore**
2. **Student records** → **Anonymized sheets**
3. **Direct status updates** → **Controlled workflow**
4. **Client-side totals** → **Server-calculated totals**

---

## 🧪 Testing

### Manual Testing

See `DEMO_CREDENTIALS.md` for complete testing guide.

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test authentication
curl http://localhost:5000/api/sheets/mine \
  -H "Authorization: Bearer <token>"

# Test validation error
curl -X POST http://localhost:5000/api/exams \
  -H "Authorization: Bearer <controller-token>" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# Test access control
curl http://localhost:5000/api/sheets \
  -H "Authorization: Bearer <examiner-token>"
# Expected: 403 Forbidden
```

### Planted Test Cases

1. **Sheet #11**: Unmarked question (Q3)
   - Test UI for incomplete marking
   - Highlight missing marks

2. **Sheets #1-2**: Uploaded status
   - Test assignment workflow
   - Test bulk operations

---

## 📚 Documentation

### For Developers
- `API_DOCUMENTATION.md` - Complete API reference
- `ARCHITECTURE.md` - System architecture
- `FOUNDATION_SUMMARY.md` - Backend foundation
- `src/README.md` - Middleware usage guide

### For Testing
- `DEMO_CREDENTIALS.md` - Login credentials
- `src/seed/README.md` - Seed data details
- `MIGRATION_GUIDE.md` - Migration steps

---

## 🎯 Next Steps (Future Implementation)

### Coming Soon

1. **Anomaly Detection Engine**
   - Replace deprecated `/api/cheat` route
   - Detect marking anomalies
   - Flag suspicious patterns

2. **Historical Events**
   - Track marking history
   - Audit trail
   - Analytics data

3. **Calibration Sheets**
   - Known correct marks for quality control
   - Examiner calibration scoring
   - Training data

4. **Advanced Analytics**
   - Marking speed metrics
   - Consistency analysis
   - Performance dashboards

5. **Batch Operations**
   - Bulk sheet assignment
   - Batch status updates
   - Export functionality

---

## 🐛 Known Issues / Limitations

### Current Limitations

1. **No pagination** - All sheets loaded at once (implement pagination for large datasets)
2. **No caching** - Every request hits Firestore (add Redis caching)
3. **No webhooks** - No real-time notifications (add webhook system)
4. **Basic file storage** - Base64 in Firestore (migrate to Cloud Storage for production)
5. **No audit log** - Limited tracking (implement comprehensive audit logging)

### Future Improvements

1. Add pagination to sheet listing endpoints
2. Implement Redis caching for frequently accessed data
3. Add webhook system for real-time notifications
4. Migrate file storage to Cloud Storage
5. Add comprehensive audit logging
6. Implement batch operations
7. Add export/import functionality

---

## 📊 Performance Considerations

### Current Setup
- **File storage**: Base64 in Firestore (works for demo, 10MB limit)
- **Queries**: Direct Firestore queries (adequate for <10k sheets)
- **Caching**: None (rely on Firestore caching)

### Production Recommendations
- **File storage**: Migrate to Cloud Storage
- **Caching**: Add Redis for exam definitions and user profiles
- **Pagination**: Implement cursor-based pagination
- **Indexes**: Create composite indexes for complex queries
- **Rate limiting**: Adjust for production traffic

---

## ✅ Implementation Checklist

### Completed ✓

- [x] Firebase Admin SDK integration
- [x] Firestore collections (exams, sheets, identityMap, marks, users)
- [x] Authentication middleware
- [x] Role-based authorization
- [x] Exam management routes
- [x] Sheet upload with multer
- [x] Anonymized sheet IDs
- [x] Identity mapping (separate collection)
- [x] Sheet marking workflow
- [x] Server-side mark calculation
- [x] Zod validation schemas
- [x] Status workflow controls
- [x] Access control enforcement
- [x] Demo data seed script
- [x] Comprehensive documentation
- [x] Deprecated legacy routes

### Future Enhancements

- [ ] Anomaly detection engine
- [ ] Historical events tracking
- [ ] Calibration sheets
- [ ] Pagination
- [ ] Caching layer
- [ ] Cloud Storage migration
- [ ] Batch operations
- [ ] Export functionality
- [ ] Audit logging
- [ ] Webhooks

---

**Status:** ✅ **Production Ready** (with noted limitations)  
**Last Updated:** September 2026  
**Version:** 1.0.0
