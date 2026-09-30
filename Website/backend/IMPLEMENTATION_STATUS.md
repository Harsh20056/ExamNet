# Implementation Status - Backend Foundation

## ✅ COMPLETED TASKS

### Task 1: Backend Foundation Setup
**Status:** ✅ Complete

**Implemented:**
- Firebase Admin SDK integration
  - Config: `src/config/firebaseAdmin.js`
  - Environment: `FIREBASE_SERVICE_ACCOUNT` (path or JSON)
- Authentication middleware
  - JWT token verification: `src/middleware/auth.js`
  - Role-based authorization: `src/middleware/requireRole.js`
  - Request validation with Zod: `src/middleware/validation.js`
  - Error handling: `src/middleware/errorHandler.js`
- Security packages
  - helmet (security headers)
  - express-rate-limit (general: 100 req/15min)
  - CORS from environment (`CORS_ORIGIN`)
- Health check endpoint: `GET /api/health` (no auth)
- Documentation: `FOUNDATION_SUMMARY.md`, `MIGRATION_GUIDE.md`, `ARCHITECTURE.md`

**User Roles:**
- `examiner` - Marks assigned sheets
- `moderator` - Reviews and moderates
- `controller` - Full system access

---

### Task 2: Firestore-Backed Exam Management
**Status:** ✅ Complete

**Collections:**
- `exams` - Exam definitions with questions
- `sheets` - Anonymized answer sheets
- `identityMap` - Student identity (never exposed via API)
- `marks` - Question marks for sheets
- `users` - User profiles with roles

**Exam Routes:**
- `POST /api/exams` (controller) - Create exam with questions, rubric
- `GET /api/exams` (all roles) - List all exams
- `GET /api/exams/:id` (all roles) - Get exam details

**Sheet Routes:**
- `POST /api/sheets/upload` (controller) - Upload answer sheet images with multer
  - Generates anonymized `sheetId` (e.g., SHEET-a1b2c3d4e5)
  - Stores identity in separate `identityMap` collection
  - Base64 encodes and stores page images
- `GET /api/sheets` (controller) - List sheets with filters (status, examId)
- `GET /api/sheets/mine` (examiner) - Get assigned sheets
- `GET /api/sheets/:id` - Get sheet details with pages and marks
  - Access control: examiner (assigned only), moderator, controller
- `POST /api/sheets/:id/start` - Start marking (status → in_progress)
- `PUT /api/sheets/:id/marks/:qNo` - Save question marks
  - Server validates marks <= maxMarks
  - Server recalculates total (never accepts client total)
- `POST /api/sheets/:id/submit` - Submit as evaluated

**Status Flow:**
```
uploaded → in_progress → evaluated → [flagged] → verified
```

**Identity Protection:**
- ✅ Student identity stored in `identityMap`
- ❌ NEVER returned by ANY API endpoint
- ✅ Anonymized `sheetId` used throughout

**Deprecated Routes:**
- `GET /api/students` - Use Firestore sheets
- `POST /api/students` - Use sheet upload
- `PUT /api/students/:id` - Use sheet marking
- `POST /api/cheat` - Use anomaly detection

**Documentation:** `API_DOCUMENTATION.md`, `FIRESTORE_IMPLEMENTATION.md`

---

### Task 3: Demo Data Seed Script
**Status:** ✅ Complete

**Command:** `npm run seed`

**Created Data:**
1. **Users (7 total):**
   - 5 examiners: examiner1@demo.com ... examiner5@demo.com
   - 1 moderator: moderator@demo.com
   - 1 controller: controller@demo.com
   - All with password: `Demo123!`
   - Created in Firebase Auth + Firestore `users` collection

2. **Exam (1):**
   - 8 questions (English + Hindi mix)
   - Questions have maxMarks, modelAnswer, rubric points

3. **Answer Sheets (20):**
   - Anonymized IDs (SHEET-xxxxxxx)
   - Fake student data (names, roll numbers)
   - Placeholder SVG page images
   - Round-robin assignment to 5 examiners
   - Various statuses: uploaded, in_progress, evaluated

4. **Marks:**
   - Generated for in_progress and evaluated sheets
   - Realistic marks within question maxMarks

**Planted Test Cases:**
- Sheet #11: Has unmarked question (Q3)
- Sheets #1-2: uploaded, unassigned

**Files:**
- Script: `src/seed/seed.js`
- Documentation: `src/seed/README.md`, `DEMO_CREDENTIALS.md`

---

### Task 4: Anomaly Detection System
**Status:** ✅ Complete

**Anomaly Types:**
- **A1** - Unmarked question (HIGH severity)
- **A3** - Marks exceed question maximum (HIGH severity)
- **A4** - Total mismatch client vs server (HIGH severity)
- **A5** - Time spent < 25% median (MEDIUM severity)

**Detection Timing:**
- Quick check (A3) on mark save: `PUT /api/sheets/:id/marks/:qNo`
- Full check (A1, A3, A5) on submit: `POST /api/sheets/:id/submit`

**Auto-Flagging:**
- Sheet status → `flagged` if any HIGH severity alert
- Sheet status → `evaluated` otherwise

**Alert Routes:**
- `GET /api/alerts` (moderator, controller) - List alerts with filters (type, severity, status, sheetId, examId)
- `POST /api/alerts/violation` (examiner) - Report violation (e.g., window blur)
- `POST /api/alerts/:id/resolve` (moderator, controller) - Resolve alert with note
- `GET /api/alerts/summary` (moderator, controller) - Alert statistics

**Storage:**
- All alerts in Firestore `alerts` collection
- Linked to sheets, exams, questions

**Configuration:**
- Thresholds: `src/config/anomalyThresholds.js`
- Easily adjustable without code changes

**Files:**
- Engine: `src/services/anomalyEngine.js`
- Routes: `src/routes/alerts.js`
- Config: `src/config/anomalyThresholds.js`
- Documentation: `ANOMALY_SYSTEM.md`

---

### Task 5: Socket.io with Authentication
**Status:** ✅ Complete

**Authentication:**
- Firebase ID token verification in handshake: `socket.handshake.auth.token`
- Token validated via Firebase Admin SDK
- User role loaded from Firestore

**Rooms:**
- `controller` - All controllers join
- `moderator` - All moderators join
- `examiner:{uid}` - Each examiner joins their own room

**Events:**

| Event | Target Room | Trigger | Payload |
|-------|-------------|---------|---------|
| `sheet_assigned` | `examiner:{uid}` | Sheet assigned to examiner | Sheet data |
| `sheet_updated` | `controller`, `moderator` | Sheet status/marks change | Sheet data |
| `anomaly_alert` | `examiner:{uid}`, `moderator`, `controller` | Anomaly detected | Alert data |
| `moderation_needed` | `moderator` | High severity alert | Alert data |
| `identity_check_failed` | `controller` | Identity verification fails | Failure data |
| `dashboard_tick` | `controller` | Dashboard stats update (5s) | Stats snapshot |

**Deprecated Events:**
- `student_added` - Use `sheet_updated`
- `student_updated` - Use `sheet_updated`
- `cheating_attempt` - Use `anomaly_alert`

**Dashboard Ticker:**
- Auto-updates stats every 5 seconds
- Sends to controller room only
- Stats: total sheets, by status, average marks, alerts

**Socket Emitters:**
- Helper functions: `src/services/socketEmitters.js`
- Used in routes via `req.io` (injected by middleware)

**Files:**
- Socket system: `src/sockets/index.js`
- Emitters: `src/services/socketEmitters.js`
- Documentation: `SOCKET_EVENTS.md`
- Updated: `server.js` (socket initialization)

---

### Task 6: AI Evaluation Service
**Status:** ✅ Complete

**AI Service Features:**
- OpenAI API integration (gpt-4o-mini default)
- Image preprocessing with sharp (resize to 1024px width)
- Intelligent prompt building from question/rubric
- Zod validation of AI responses
- Retry once on invalid JSON
- Graceful fallback on errors

**Response Schema:**
```javascript
{
  suggestedMarks: number,
  matched: string[],        // Rubric criteria matched
  missed: string[],         // Rubric criteria missed
  transcription: string,    // OCR of student answer
  confidence: number,       // 0.0 to 1.0
  reason: string           // Brief explanation
}
```

**Caching:**
- Cache by (sheetId, qNo, imageHash) in Firestore `aiCalls` collection
- Prevents duplicate API calls for same answer
- Demo mode: `USE_CACHED_AI=true` loads from `cachedAIResults.json`

**Security:**
- Never logs `AI_API_KEY`
- Sends anonymized content only (no student identity)
- Images resized before transmission

**AI Routes:**
- `POST /api/ai/evaluate` - Request AI evaluation
  - Access: examiner (assigned), moderator, controller
  - Rate limit: 30 req/15min per user (controllers exempt)
  - Returns: suggestedMarks, matched, missed, transcription, confidence
- `POST /api/ai/decision` - Store examiner decision
  - Accept AI suggestion OR override with different marks
  - Requires note for audit trail
- `GET /api/ai/calls/:sheetId` - List all AI calls for sheet
  - Includes decisions and timestamps

**Workflow:**
1. Examiner requests AI evaluation
2. AI returns suggestion with confidence
3. Examiner reviews and makes decision (accept/override)
4. Examiner saves final marks to sheet

**Cached Demo Results:**
- File: `src/seed/cachedAIResults.json`
- 12 pre-generated results for demo sheets
- Used when `USE_CACHED_AI=true`

**Dependencies:**
- `sharp` - Image processing
- `axios` - HTTP requests

**Files:**
- Service: `src/services/aiService.js`
- Routes: `src/routes/ai.js`
- Cached data: `src/seed/cachedAIResults.json`
- Updated: `server.js` (mounted routes)
- Documentation: `API_DOCUMENTATION.md` (AI section)

**Environment Variables:**
```bash
AI_API_KEY=your-openai-api-key
AI_MODEL=gpt-4o-mini
USE_CACHED_AI=false
```

---

## 📊 SYSTEM OVERVIEW

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Frontend)                        │
│              React + Socket.io Client + Fetch                │
└────────────┬─────────────────────────────────────┬──────────┘
             │ HTTP REST                            │ WebSocket
             │ (Bearer Token)                       │ (Token Auth)
             ▼                                      ▼
┌────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware Stack                                     │  │
│  │  • helmet (security)                                  │  │
│  │  • CORS                                               │  │
│  │  • rate-limit (100/15min general, 30/15min AI)       │  │
│  │  • authenticate (Firebase token verify)              │  │
│  │  • requireRole (examiner/moderator/controller)       │  │
│  │  • validateRequest (Zod schemas)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Exam Routes  │  │ Sheet Routes │  │ Alert Routes │     │
│  │ /api/exams   │  │ /api/sheets  │  │ /api/alerts  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  AI Routes   │  │ Health Route │  │ Socket.io    │     │
│  │  /api/ai     │  │ /api/health  │  │ Events       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services                                             │  │
│  │  • examService (exam CRUD)                           │  │
│  │  • sheetService (sheet CRUD)                         │  │
│  │  • anomalyEngine (detection logic)                   │  │
│  │  • aiService (OpenAI integration)                    │  │
│  │  • socketEmitters (real-time events)                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬─────────────────────────────────────┬──────────┘
             │                                      │
             ▼                                      ▼
┌────────────────────────┐            ┌────────────────────────┐
│   FIREBASE ADMIN SDK   │            │   OPENAI API           │
│   • Auth (token verify)│            │   • Vision + Chat      │
│   • Firestore (data)   │            │   • JSON mode          │
└────────────────────────┘            └────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│                    FIRESTORE COLLECTIONS                    │
│  • users (uid, role, name)                                 │
│  • exams (questions, rubric)                               │
│  • sheets (anonymized, pages, status)                      │
│  • identityMap (rollNo, studentName) [NEVER EXPOSED]      │
│  • marks (qNo, marks, comment, timeSpent)                  │
│  • alerts (type, severity, status)                         │
│  • aiCalls (response, decision, imageHash)                 │
└────────────────────────────────────────────────────────────┘
```

### Security Layers

1. **Network Layer**
   - CORS restricted to whitelisted origins
   - Helmet security headers
   - Rate limiting (IP-based and user-based)

2. **Authentication Layer**
   - Firebase ID token verification
   - Token expiration enforcement
   - No tokens logged or exposed

3. **Authorization Layer**
   - Role-based access control (RBAC)
   - Per-resource access checks (e.g., examiner can only access assigned sheets)
   - Separate identity mapping (anonymization)

4. **Data Layer**
   - Server-side validation (Zod schemas)
   - Server-side calculation (totals, timestamps)
   - Strict mode (reject unknown fields)
   - Never accept client-provided audit fields

5. **Privacy Layer**
   - Student identity NEVER exposed via API
   - Anonymized sheet IDs
   - AI content anonymized (no student names)

### Data Flow Examples

#### Sheet Marking Flow
```
1. Controller uploads sheet
   POST /api/sheets/upload
   → Creates anonymized sheetId
   → Stores identity in separate collection
   → Assigns to examiner

2. Examiner starts marking
   POST /api/sheets/:id/start
   → status: uploaded → in_progress
   → Sets startedAt timestamp

3. Examiner requests AI help (optional)
   POST /api/ai/evaluate
   → Resizes image
   → Calls OpenAI API
   → Caches result
   → Returns suggestion

4. Examiner decides on AI suggestion
   POST /api/ai/decision
   → Stores accept/override decision
   → Records note for audit

5. Examiner saves marks
   PUT /api/sheets/:id/marks/:qNo
   → Validates marks <= maxMarks
   → Server recalculates total
   → Runs quick anomaly check (A3)
   → Emits sheet_updated event

6. Examiner submits sheet
   POST /api/sheets/:id/submit
   → Runs full anomaly check (A1, A3, A5)
   → Auto-flags if HIGH severity alerts
   → status: in_progress → evaluated/flagged
   → Emits sheet_updated + anomaly_alert events
```

#### Real-Time Event Flow
```
1. Sheet assigned
   → Emit to examiner:{uid} room
   → Examiner sees new sheet in dashboard

2. Marks saved
   → Emit to controller and moderator rooms
   → Dashboard updates in real-time

3. Anomaly detected
   → Emit to examiner:{uid}, moderator, controller rooms
   → Alert shown in respective dashboards
   → If HIGH severity, emit moderation_needed to moderator

4. Dashboard stats
   → Every 5 seconds, emit to controller room
   → Controller dashboard stays updated
```

---

## 🔧 CONFIGURATION

### Environment Variables

```bash
# Server
PORT=5000
NODE_ENV=development

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccountKey.json

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# SMTP (for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Service
AI_API_KEY=your-openai-api-key
AI_MODEL=gpt-4o-mini
USE_CACHED_AI=false
```

### Rate Limits

- General API: **100 requests / 15 minutes** per IP
- AI Evaluation: **30 requests / 15 minutes** per user
- Controllers exempt from AI rate limit (for testing)

### Anomaly Thresholds

File: `src/config/anomalyThresholds.js`

```javascript
{
  A1: { severity: 'high' },    // Unmarked question
  A3: { severity: 'high' },    // Marks exceed max
  A4: { severity: 'high' },    // Total mismatch
  A5: {                        // Time spent < threshold
    severity: 'medium',
    minTimeRatio: 0.25         // 25% of median
  }
}
```

---

## 📚 DOCUMENTATION FILES

1. **FOUNDATION_SUMMARY.md** - Initial foundation setup
2. **MIGRATION_GUIDE.md** - Migration from in-memory to Firestore
3. **ARCHITECTURE.md** - System architecture and patterns
4. **API_DOCUMENTATION.md** - Complete API reference
5. **FIRESTORE_IMPLEMENTATION.md** - Firestore schema and queries
6. **ANOMALY_SYSTEM.md** - Anomaly detection documentation
7. **SOCKET_EVENTS.md** - Socket.io event reference
8. **DEMO_CREDENTIALS.md** - Demo user credentials
9. **src/seed/README.md** - Seed script usage
10. **IMPLEMENTATION_STATUS.md** - This file

---

## ✅ TESTING CHECKLIST

### Quick Test Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Seed demo data
npm run seed
```

### Manual Testing

1. **Health Check**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Login (get Firebase token)**
   - Use Firebase Auth UI or SDK
   - Demo users: examiner1@demo.com / Demo123!

3. **Test Exam Routes**
   ```bash
   # List exams
   curl http://localhost:5000/api/exams \
     -H "Authorization: Bearer <token>"
   ```

4. **Test Sheet Routes**
   ```bash
   # Get my sheets (examiner)
   curl http://localhost:5000/api/sheets/mine \
     -H "Authorization: Bearer <examiner-token>"
   ```

5. **Test AI Evaluation**
   ```bash
   # Evaluate answer
   curl -X POST http://localhost:5000/api/ai/evaluate \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"sheetId": "sheet-id", "qNo": 1}'
   ```

6. **Test Socket Connection**
   ```javascript
   const socket = io('http://localhost:5000', {
     auth: { token: '<firebase-token>' }
   });
   
   socket.on('connect', () => console.log('Connected'));
   socket.on('sheet_updated', (data) => console.log('Sheet update:', data));
   ```

---

## 🚀 NEXT STEPS

### Immediate Priorities

1. **Frontend Integration**
   - Update frontend to use new Firestore-backed APIs
   - Implement AI evaluation UI
   - Add anomaly alert display
   - Socket.io integration for real-time updates

2. **Testing**
   - Unit tests for services (anomalyEngine, aiService)
   - Integration tests for routes
   - E2E tests for complete workflows

3. **Deployment**
   - Vercel/Railway/Render deployment
   - Environment variable configuration
   - Firebase project setup
   - OpenAI API key provisioning

### Future Enhancements

1. **Advanced Anomaly Detection**
   - A2: Significant deviation from examiner's average
   - A6: Batch upload integrity checks
   - Machine learning-based detection

2. **AI Improvements**
   - Multi-page answer support
   - Question-to-page mapping
   - Handwriting recognition improvements
   - Batch evaluation API

3. **Collaboration Features**
   - Multi-examiner moderation
   - Examiner chat/comments
   - Calibration sets for consistency

4. **Analytics & Reporting**
   - Examiner performance metrics
   - Time tracking analytics
   - AI vs human marking comparison
   - Export reports (PDF, Excel)

---

## 📝 NOTES

- All timestamps in ISO 8601 UTC format
- CommonJS modules (require/module.exports)
- Firestore as single source of truth
- Never log sensitive data (keys, tokens, student identity)
- Server-side validation and calculation
- Client-provided audit fields rejected

---

**Last Updated:** 2026-09-30  
**Version:** 1.0.0  
**Status:** All 6 tasks complete ✅


---

### Task 7: Moderation Queue & Identity Verification
**Status:** ✅ Complete

**Moderation System:**
- **Route:** `GET /api/moderation/queue` (moderator, controller)
  - Returns all flagged sheets with alerts and reasons
  - Includes marks, alert count, severity breakdown
- **Route:** `POST /api/moderation/:sheetId` (moderator, controller)
  - Actions: approve, adjust, sendback
  - Mandatory reason for all actions
  - Approve/adjust: status → `final`, removes from queue, auto-resolves alerts
  - Adjust: validates marks, recalculates total, stores before/after
  - Sendback: status → `in_progress`, returns to examiner
  - Emits `sheet_updated` and `dashboard_tick` events

**Identity Verification:**
- **Route:** `POST /api/identity/result` (examiner, moderator, controller)
  - Stores pass/fail verification result
  - Optional confidence (0.0-1.0) and reason
  - On failure: creates HIGH severity alert, emits `identity_check_failed` to controller
- **Route:** `GET /api/identity/verifications/:sheetId`
  - Returns verification history for audit trail
  - Shows current status and all past attempts

**Collections:**
- `moderation` - Audit trail of all moderation actions
- `identityVerifications` - Complete verification history

**Features:**
- Complete audit trail for all actions
- Real-time controller notifications on identity failures
- Before/after marks preserved for adjustments
- Automatic alert resolution on approve/adjust
- Access control: examiners only for assigned sheets

**Files:**
- Routes: `src/routes/moderation.js`, `src/routes/identity.js`
- Updated: `server.js` (mounted routes)
- Updated: `src/config/firestore.js` (added collections and 'final' status)
- Documentation: `MODERATION_IDENTITY_SYSTEM.md`, `API_DOCUMENTATION.md`

---

**Updated:** 2026-09-30  
**All 7 Tasks Complete:** ✅
