# Task 7: Moderation Queue & Identity Verification - Complete ✅

## Overview

Task 7 adds moderation queue management for flagged sheets and identity verification for proctoring integrity.

---

## ✅ Implemented Features

### 1. Moderation Queue System

**Routes:**
- `GET /api/moderation/queue` - Get all flagged sheets awaiting moderation
- `POST /api/moderation/:sheetId` - Perform moderation action

**Moderation Actions:**

1. **Approve** - Accept examiner's marks as-is
   - Status: `flagged` → `final`
   - Alerts: All HIGH severity alerts auto-resolved
   - Queue: Sheet removed from moderation queue

2. **Adjust** - Modify specific marks
   - Status: `flagged` → `final`
   - Marks: Updated as specified, total recalculated by server
   - Alerts: All HIGH severity alerts auto-resolved
   - Queue: Sheet removed from moderation queue
   - Audit: Before/after marks stored in `moderation` collection

3. **Sendback** - Return to examiner for re-marking
   - Status: `flagged` → `in_progress`
   - Marks: Unchanged
   - Alerts: Remain open
   - Queue: Sheet returns to examiner's queue for re-work

**Features:**
- Mandatory reason for all moderation actions (1-2000 characters)
- Server-side mark validation (adjusted marks ≤ maxMarks)
- Server-side total recalculation (never trust client)
- Complete audit trail with before/after marks
- Real-time socket events (`sheet_updated`, `dashboard_tick`)

---

### 2. Identity Verification System

**Routes:**
- `POST /api/identity/result` - Store identity verification result (pass/fail)
- `GET /api/identity/verifications/:sheetId` - Get verification history

**Verification Results:**
- `pass` - Identity verified successfully
- `fail` - Identity verification failed (creates HIGH severity alert)

**On Verification Failure:**
1. Creates HIGH severity alert (`type: 'identity_check_failed'`)
2. Emits `identity_check_failed` socket event to controller room
3. Updates sheet: `identityVerified: false`
4. Stores in `identityVerifications` collection

**Features:**
- Optional confidence score (0.0 to 1.0)
- Optional reason/explanation
- Complete verification history for audit trail
- Real-time controller notifications on failures
- Access control: examiners only for assigned sheets

---

## 📂 Files Created

### Routes
1. **`src/routes/moderation.js`** - Moderation queue and actions
   - GET /api/moderation/queue
   - POST /api/moderation/:sheetId

2. **`src/routes/identity.js`** - Identity verification
   - POST /api/identity/result
   - GET /api/identity/verifications/:sheetId

### Documentation
3. **`MODERATION_IDENTITY_SYSTEM.md`** - Complete system documentation
4. **`TASK_7_COMPLETE.md`** - This file

### Updated Files
5. **`server.js`** - Mounted new routes
6. **`src/config/firestore.js`** - Added collections and 'final' status
7. **`API_DOCUMENTATION.md`** - Added route documentation
8. **`IMPLEMENTATION_STATUS.md`** - Added Task 7 summary

---

## 🗄️ Database Schema

### New Collections

#### `moderation` Collection
Stores all moderation actions for audit trail.

```javascript
{
  sheetId: string,           // Sheet document ID
  examId: string,            // Exam document ID
  action: string,            // 'approve' | 'adjust' | 'sendback'
  reason: string,            // Mandatory reason
  beforeMarks: array,        // Marks before moderation
  afterMarks: array,         // Marks after moderation
  beforeTotal: number,       // Total before
  afterTotal: number,        // Total after
  moderatedBy: string,       // UID of moderator
  moderatedAt: string        // ISO 8601 timestamp
}
```

**Indexes:**
- `sheetId` (ASC)
- `moderatedBy` (ASC)
- `moderatedAt` (DESC)

---

#### `identityVerifications` Collection
Stores all identity verification attempts.

```javascript
{
  sheetId: string,           // Sheet document ID
  examId: string,            // Exam document ID
  result: string,            // 'pass' | 'fail'
  confidence: number,        // 0.0 to 1.0 (optional)
  reason: string,            // Explanation (optional)
  verifiedBy: string,        // UID of verifier
  verifiedAt: string         // ISO 8601 timestamp
}
```

**Indexes:**
- `sheetId` (ASC)
- `verifiedAt` (DESC)
- `result` (ASC)

---

### Updated Collections

#### `sheets` Collection
Added identity verification fields:

```javascript
{
  // ... existing fields ...
  identityVerified: boolean,      // true if passed verification
  identityVerifiedAt: string,     // ISO 8601 timestamp
  identityVerifiedBy: string      // UID of verifier
}
```

#### Updated Status Enum
Added `final` status to sheet status flow:

```
uploaded → in_progress → evaluated → flagged → final
                                   ↓        ↗
                              (sendback) ←─┘
```

---

## 🔐 Security & Access Control

### Moderation Routes
| Route | examiner | moderator | controller |
|-------|----------|-----------|------------|
| GET /api/moderation/queue | ❌ | ✅ | ✅ |
| POST /api/moderation/:sheetId | ❌ | ✅ | ✅ |

**Rules:**
- Only moderators and controllers can access moderation
- Examiners have no visibility into moderation queue
- All actions logged with moderator identity

---

### Identity Routes
| Route | examiner | moderator | controller |
|-------|----------|-----------|------------|
| POST /api/identity/result | ✅ (assigned only) | ✅ | ✅ |
| GET /api/identity/verifications/:sheetId | ✅ (assigned only) | ✅ | ✅ |

**Rules:**
- Examiners can only verify assigned sheets
- All verification attempts logged with verifier identity
- Cannot be modified or deleted (immutable audit trail)

---

## 📡 Real-Time Events

### `identity_check_failed`
**Target:** controller room only  
**Trigger:** Identity verification fails  
**Payload:**
```json
{
  "id": "alert123",
  "sheetId": "sheet-doc-id",
  "sheetAnonymousId": "SHEET-a1b2c3d4e5",
  "examId": "exam123",
  "result": "fail",
  "confidence": 0.42,
  "reason": "Face does not match reference descriptor",
  "verifiedBy": "examiner-uid",
  "timestamp": "2026-09-29T16:00:00.000Z"
}
```

**Purpose:** Immediate notification to controllers for security issues

---

### Updated Events

**`sheet_updated`**
- Now also emitted on moderation actions
- Target: controller, moderator rooms

**`dashboard_tick`**
- Now also emitted on moderation actions
- Target: controller room
- Trigger: Statistics update after moderation

---

## 🧪 Testing

### Test Moderation Queue

1. **Get flagged sheets:**
   ```bash
   curl http://localhost:5000/api/moderation/queue \
     -H "Authorization: Bearer <moderator-token>"
   ```

2. **Approve a sheet:**
   ```bash
   curl -X POST http://localhost:5000/api/moderation/SHEET_ID \
     -H "Authorization: Bearer <moderator-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "approve",
       "reason": "Marks reviewed and approved"
     }'
   ```

3. **Adjust marks:**
   ```bash
   curl -X POST http://localhost:5000/api/moderation/SHEET_ID \
     -H "Authorization: Bearer <moderator-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "adjust",
       "reason": "Question 3 was answered, adding marks",
       "adjustedMarks": [
         {
           "qNo": 3,
           "marks": 5,
           "comment": "Late discovery, answer was on page 2"
         }
       ]
     }'
   ```

4. **Send back to examiner:**
   ```bash
   curl -X POST http://localhost:5000/api/moderation/SHEET_ID \
     -H "Authorization: Bearer <moderator-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "sendback",
       "reason": "Question 2 marking is inconsistent with rubric"
     }'
   ```

---

### Test Identity Verification

1. **Submit pass result:**
   ```bash
   curl -X POST http://localhost:5000/api/identity/result \
     -H "Authorization: Bearer <examiner-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "sheetId": "SHEET_ID",
       "result": "pass",
       "confidence": 0.95,
       "reason": "Face matches reference with high confidence"
     }'
   ```

2. **Submit fail result (creates alert and emits event):**
   ```bash
   curl -X POST http://localhost:5000/api/identity/result \
     -H "Authorization: Bearer <examiner-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "sheetId": "SHEET_ID",
       "result": "fail",
       "confidence": 0.38,
       "reason": "Face does not match reference - possible impersonation"
     }'
   ```

3. **Get verification history:**
   ```bash
   curl http://localhost:5000/api/identity/verifications/SHEET_ID \
     -H "Authorization: Bearer <examiner-token>"
   ```

4. **Listen for identity failure event (Socket.io):**
   ```javascript
   socket.on('identity_check_failed', (data) => {
     console.log('SECURITY ALERT - Identity check failed:', data);
     // Show immediate notification to controller
     // Trigger investigation workflow
   });
   ```

---

## 📊 Workflows

### Moderation Workflow

```
1. Examiner submits sheet
   ↓
2. Anomaly detection finds HIGH severity issue
   ↓
3. Sheet status → 'flagged'
   ↓
4. Sheet appears in moderation queue
   ↓
5. Moderator reviews:
   - Sheet metadata
   - Current marks
   - Alert details
   ↓
6. Moderator decides:

   a) APPROVE
      → Marks are correct
      → Status: flagged → final
      → Alerts resolved
      → Removed from queue
      
   b) ADJUST
      → Correct specific marks
      → Total recalculated
      → Status: flagged → final
      → Alerts resolved
      → Removed from queue
      
   c) SENDBACK
      → Needs re-marking
      → Status: flagged → in_progress
      → Alerts remain open
      → Returns to examiner queue
      ↓
      Examiner re-marks
      ↓
      (repeat from step 1)
```

---

### Identity Verification Workflow

```
1. Student arrives for exam
   ↓
2. Proctor captures reference face
   ↓
3. Reference stored in identityMap
   ↓
4. During/after exam: identity check
   ↓
5. Examiner verifies:

   a) PASS
      → Sheet marked as verified
      → No alert
      → Normal processing continues
      
   b) FAIL
      → HIGH severity alert created
      → Socket event → controller
      → Sheet marked as NOT verified
      ↓
      Controller investigates:
      → Reviews webcam footage
      → Contacts proctor
      → Verifies with exam center
      ↓
      If confirmed impersonation:
      → Exam invalidated
      → Student disciplinary action
      → Alert resolved with notes
```

---

## 🎯 Use Cases

### Use Case 1: Unmarked Question Detected

**Scenario:** Examiner forgot to mark Question 3

1. Examiner submits sheet
2. Anomaly detection: A1 alert (unmarked question - HIGH)
3. Sheet flagged, appears in moderation queue
4. Moderator reviews:
   - Sees Q3 has no marks
   - Checks answer sheet images
   - Q3 was answered
5. Moderator adjusts:
   ```json
   {
     "action": "adjust",
     "reason": "Question 3 was answered but not marked",
     "adjustedMarks": [
       {"qNo": 3, "marks": 6, "comment": "Good answer"}
     ]
   }
   ```
6. Total recalculated: 18 → 24
7. Status: flagged → final
8. Alert auto-resolved
9. Sheet removed from queue

---

### Use Case 2: Marks Exceed Maximum

**Scenario:** Examiner entered 12 marks for 10-mark question

1. Examiner saves marks: Q1 = 12 marks (max 10)
2. Anomaly detection: A3 alert (marks exceed max - HIGH)
3. Sheet flagged when submitted
4. Moderator reviews:
   - Sees Q1 has 12/10 marks
   - Confirms error
5. Moderator adjusts:
   ```json
   {
     "action": "adjust",
     "reason": "Q1 marks exceeded maximum - corrected to 10",
     "adjustedMarks": [
       {"qNo": 1, "marks": 10}
     ]
   }
   ```
6. Total recalculated
7. Status: flagged → final

---

### Use Case 3: Identity Verification Failure

**Scenario:** Different person taking exam

1. Examiner reviews live webcam feed
2. Face doesn't match reference photo
3. Examiner submits:
   ```json
   {
     "sheetId": "sheet-doc-id",
     "result": "fail",
     "confidence": 0.35,
     "reason": "Face clearly different - possible impersonation"
   }
   ```
4. System creates HIGH severity alert
5. Socket event immediately sent to controller
6. Controller sees real-time notification
7. Controller investigates:
   - Reviews recorded video
   - Contacts exam center proctor
   - Confirms impersonation
8. Controller actions:
   - Marks exam as invalid
   - Initiates disciplinary process
   - Resolves alert with detailed notes

---

### Use Case 4: Inconsistent Marking - Send Back

**Scenario:** Moderator finds unclear marking logic

1. Moderator reviews flagged sheet
2. Notices marks don't align with rubric
3. Can't determine correct marks
4. Sends back:
   ```json
   {
     "action": "sendback",
     "reason": "Q2 and Q4 marking inconsistent with rubric. Please re-evaluate using provided scoring guide."
   }
   ```
5. Status: flagged → in_progress
6. Sheet returns to examiner queue
7. Examiner sees note from moderator
8. Re-evaluates questions
9. Resubmits sheet
10. (Workflow repeats)

---

## 📈 Benefits

### For Moderators
- ✅ Centralized queue of all flagged sheets
- ✅ Complete context for each sheet (marks, alerts, reasons)
- ✅ Flexible actions (approve, adjust, send back)
- ✅ Automatic alert resolution
- ✅ Complete audit trail

### For Controllers
- ✅ Real-time identity failure notifications
- ✅ Immediate security alerts
- ✅ Complete verification history
- ✅ Dashboard stats automatically updated

### For System Integrity
- ✅ Multi-layer quality control
- ✅ Prevents incorrect marks from becoming final
- ✅ Detects and prevents impersonation
- ✅ Complete audit trail for compliance
- ✅ Immutable records for investigations

---

## 🔍 Validation & Error Handling

### Moderation Validation
- ✅ Sheet must be in 'flagged' status
- ✅ Reason is mandatory for all actions
- ✅ Adjusted marks must not exceed maxMarks
- ✅ adjustedMarks required if action is 'adjust'
- ✅ Server recalculates totals (never trust client)

### Identity Validation
- ✅ Result must be 'pass' or 'fail'
- ✅ Confidence must be 0.0 to 1.0 (if provided)
- ✅ Examiners can only verify assigned sheets
- ✅ All attempts logged immutably

### Error Responses
```json
{
  "success": false,
  "error": "Sheet is not flagged for moderation",
  "timestamp": "2026-09-30T..."
}
```

---

## 📚 Documentation

Complete documentation available in:

1. **MODERATION_IDENTITY_SYSTEM.md** - Comprehensive system guide
   - Workflows, schemas, use cases
   - Testing instructions
   - Integration details

2. **API_DOCUMENTATION.md** - API reference
   - Route details with examples
   - Request/response formats
   - Access control matrix

3. **IMPLEMENTATION_STATUS.md** - Implementation tracking
   - All 7 tasks documented
   - Files created/updated
   - Feature summaries

4. **TASK_7_COMPLETE.md** - This document
   - Task 7 specific details
   - Quick reference guide

---

## ✅ Completion Checklist

- [x] Moderation queue route implemented
- [x] Moderation action route (approve/adjust/sendback)
- [x] Identity verification result route
- [x] Identity verification history route
- [x] Routes mounted in server.js
- [x] Firestore collections updated
- [x] Status enum updated (added 'final')
- [x] Socket events implemented
- [x] Access control enforced
- [x] Validation schemas created
- [x] API documentation updated
- [x] System documentation created
- [x] Implementation status updated
- [x] Testing instructions provided

---

## 🚀 Ready for Production

Task 7 is complete and ready for integration with the frontend. All routes are:
- ✅ Authenticated with Firebase Admin SDK
- ✅ Authorized with role-based access control
- ✅ Validated with Zod schemas
- ✅ Documented with examples
- ✅ Integrated with real-time events
- ✅ Audit-trail enabled

---

**Task 7 Status:** Complete ✅  
**Version:** 1.0.0  
**Last Updated:** 2026-09-30
