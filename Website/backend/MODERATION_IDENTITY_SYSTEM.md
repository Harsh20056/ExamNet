# Moderation & Identity Verification System

## Overview

This document describes the moderation queue system for flagged answer sheets and the identity verification system for proctoring.

---

## Moderation System

### Purpose

When answer sheets are marked and submitted, the anomaly detection system may flag them for moderator review if HIGH severity issues are detected. The moderation system provides a queue for moderators to review, approve, adjust, or send back flagged sheets.

### Firestore Collections

#### `moderation` Collection
Stores all moderation actions for audit trail.

**Document Schema:**
```javascript
{
  sheetId: string,           // Sheet document ID
  examId: string,            // Exam document ID
  action: string,            // 'approve' | 'adjust' | 'sendback'
  reason: string,            // Mandatory reason for action
  beforeMarks: array,        // Marks before moderation
  afterMarks: array,         // Marks after moderation (if adjusted)
  beforeTotal: number,       // Total marks before
  afterTotal: number,        // Total marks after
  moderatedBy: string,       // UID of moderator
  moderatedAt: string        // ISO 8601 timestamp
}
```

**Indexes Required:**
- `sheetId` (for history lookup)
- `moderatedBy` (for moderator analytics)
- `moderatedAt` (for time-based queries)

---

### API Routes

#### GET /api/moderation/queue
**Access:** moderator, controller

**Purpose:** Get all flagged sheets awaiting moderation

**Response Includes:**
- Sheet metadata (anonymized ID, exam title)
- Current marks with comments
- HIGH severity alerts with reasons
- Alert count and severity breakdown

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sheet-doc-id",
      "sheetId": "SHEET-a1b2c3d4e5",
      "examId": "exam123",
      "examTitle": "Midterm Examination 2026",
      "assignedTo": "examiner-uid",
      "totalMarks": 18,
      "maxMarks": 25,
      "completedAt": "2026-09-29T14:30:00.000Z",
      "marks": [
        { "qNo": 1, "marks": 8, "comment": "Good work" },
        { "qNo": 2, "marks": 10, "comment": "Excellent" }
      ],
      "alerts": [
        {
          "id": "alert123",
          "type": "A1",
          "severity": "high",
          "message": "Unmarked question detected",
          "metadata": { "questionNumber": 3 },
          "createdAt": "2026-09-29T14:30:00.000Z"
        }
      ],
      "alertCount": 1
    }
  ]
}
```

---

#### POST /api/moderation/:sheetId
**Access:** moderator, controller

**Purpose:** Perform moderation action on a flagged sheet

**Actions:**

1. **Approve** - Accept examiner's marks without changes
   - Status: `flagged` → `final`
   - Marks: Unchanged
   - Alerts: All HIGH severity alerts auto-resolved
   - Queue: Sheet removed from moderation queue

2. **Adjust** - Modify one or more marks
   - Status: `flagged` → `final`
   - Marks: Updated as specified, total recalculated
   - Alerts: All HIGH severity alerts auto-resolved
   - Queue: Sheet removed from moderation queue
   - Audit: Before/after marks stored

3. **Sendback** - Return to examiner for re-marking
   - Status: `flagged` → `in_progress`
   - Marks: Unchanged
   - Alerts: Remain open
   - Queue: Sheet returns to examiner's queue

**Request Examples:**

**Approve:**
```json
{
  "action": "approve",
  "reason": "Marks are accurate and consistent with rubric"
}
```

**Adjust:**
```json
{
  "action": "adjust",
  "reason": "Question 1 overmarked, Question 3 was actually answered",
  "adjustedMarks": [
    {
      "qNo": 1,
      "marks": 7,
      "comment": "Reduced due to missing examples"
    },
    {
      "qNo": 3,
      "marks": 5,
      "comment": "Previously unmarked, now graded"
    }
  ]
}
```

**Sendback:**
```json
{
  "action": "sendback",
  "reason": "Question 3 needs re-evaluation, unclear marking criteria applied"
}
```

**Validation:**
- `action` is required and must be valid enum value
- `reason` is mandatory (1-2000 characters) for all actions
- `adjustedMarks` is required if action is 'adjust'
- Each adjusted mark must not exceed question's maxMarks
- Sheet must have status 'flagged' to be moderated

**Side Effects:**
- Updates sheet document with new status, total, moderatedAt, moderatedBy
- Stores moderation record in `moderation` collection
- Resolves HIGH severity alerts (if approve/adjust)
- Emits `sheet_updated` socket event
- Emits `dashboard_tick` socket event to controller

---

### Moderation Workflow

```
1. Examiner submits sheet
   ↓
2. Anomaly detection runs
   ↓
3. HIGH severity anomaly detected
   ↓
4. Sheet status → 'flagged'
   ↓
5. Sheet appears in moderation queue
   ↓
6. Moderator reviews sheet, marks, and alerts
   ↓
7. Moderator decides action:
   
   a) APPROVE
      - Marks are correct
      - Status → 'final'
      - Alerts resolved
      
   b) ADJUST
      - Correct specific marks
      - Total recalculated
      - Status → 'final'
      - Alerts resolved
      
   c) SENDBACK
      - Examiner needs to re-mark
      - Status → 'in_progress'
      - Alerts remain open
      ↓
      Examiner re-marks and resubmits
      ↓
      (repeat from step 2)
```

---

### Real-Time Events

**sheet_updated**
- **Target:** controller, moderator
- **Trigger:** Any moderation action
- **Payload:** Updated sheet data

**dashboard_tick**
- **Target:** controller
- **Trigger:** Any moderation action
- **Payload:** Stats update trigger

---

### Security & Access Control

**Role-Based Access:**
- Only `moderator` and `controller` roles can access moderation routes
- Examiners cannot access moderation queue or perform moderation actions

**Audit Trail:**
- All moderation actions stored with full context
- Before/after marks preserved
- Moderator identity and timestamp recorded
- Cannot be modified or deleted

**Data Integrity:**
- Server validates all adjusted marks against question maxMarks
- Server recalculates totals (never trusts client)
- Status transitions are controlled and validated

---

## Identity Verification System

### Purpose

The identity verification system allows examiners to verify that the student taking the exam matches their reference face descriptor. Failed verifications create HIGH severity alerts and notify controllers immediately.

### Firestore Collections

#### `identityVerifications` Collection
Stores all identity verification attempts for audit trail.

**Document Schema:**
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

**Indexes Required:**
- `sheetId` (for history lookup)
- `result` (for statistics)
- `verifiedAt` (for time-based queries)

---

### API Routes

#### POST /api/identity/result
**Access:** examiner (assigned sheets only), moderator, controller

**Purpose:** Store identity verification result

**Request Schema:**
```javascript
{
  sheetId: string,           // Required
  result: 'pass' | 'fail',   // Required
  confidence: number,        // Optional (0.0 to 1.0)
  reason: string             // Optional (1-2000 chars)
}
```

**Examples:**

**Pass:**
```json
{
  "sheetId": "sheet-doc-id",
  "result": "pass",
  "confidence": 0.95,
  "reason": "Face matches reference descriptor with high confidence"
}
```

**Fail:**
```json
{
  "sheetId": "sheet-doc-id",
  "result": "fail",
  "confidence": 0.42,
  "reason": "Face does not match reference descriptor - possible impersonation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sheetId": "SHEET-a1b2c3d4e5",
    "result": "fail",
    "confidence": 0.42,
    "verifiedAt": "2026-09-29T16:00:00.000Z",
    "alert": "Identity check failure alert created"
  }
}
```

**Behavior on Failure:**
1. Creates HIGH severity alert:
   - Type: `identity_check_failed`
   - Severity: `high`
   - Status: `open`
   - Message: "Identity verification failed"

2. Emits `identity_check_failed` socket event to controller room:
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

3. Updates sheet document:
   - `identityVerified: false`
   - `identityVerifiedAt: timestamp`
   - `identityVerifiedBy: uid`

---

#### GET /api/identity/verifications/:sheetId
**Access:** examiner (assigned sheets only), moderator, controller

**Purpose:** Get complete identity verification history for a sheet

**Response:**
```json
{
  "success": true,
  "data": {
    "sheetId": "SHEET-a1b2c3d4e5",
    "currentStatus": {
      "verified": false,
      "verifiedAt": "2026-09-29T16:00:00.000Z",
      "verifiedBy": "examiner-uid"
    },
    "history": [
      {
        "id": "verification-id-1",
        "result": "fail",
        "confidence": 0.42,
        "reason": "Face does not match reference descriptor",
        "verifiedBy": "examiner-uid",
        "verifiedAt": "2026-09-29T16:00:00.000Z"
      },
      {
        "id": "verification-id-2",
        "result": "pass",
        "confidence": 0.88,
        "reason": "Initial verification successful",
        "verifiedBy": "examiner-uid",
        "verifiedAt": "2026-09-29T10:00:00.000Z"
      }
    ]
  }
}
```

**Use Cases:**
- Audit trail for identity checks
- Investigating suspicious verification patterns
- Analytics on verification confidence levels

---

### Identity Verification Workflow

```
1. Student arrives for exam
   ↓
2. Proctor captures reference face descriptor
   ↓
3. Reference stored in identityMap
   ↓
4. During/after exam, examiner verifies identity
   ↓
5. Examiner submits verification result:
   
   a) PASS
      - Sheet marked as identity verified
      - No alert created
      - Exam proceeds normally
      
   b) FAIL
      - HIGH severity alert created
      - Controller notified via socket event
      - Sheet marked as identity NOT verified
      - Controller investigates
      ↓
      Controller reviews alert and takes action:
      - Contact proctor for manual verification
      - Review exam video footage
      - Invalidate exam attempt if confirmed impersonation
```

---

### Real-Time Events

**identity_check_failed**
- **Target:** controller room only
- **Trigger:** Identity verification fails
- **Payload:**
  ```json
  {
    "id": "alert123",
    "sheetId": "sheet-doc-id",
    "sheetAnonymousId": "SHEET-a1b2c3d4e5",
    "examId": "exam123",
    "result": "fail",
    "confidence": 0.42,
    "reason": "Face does not match",
    "verifiedBy": "examiner-uid",
    "timestamp": "2026-09-29T16:00:00.000Z"
  }
  ```
- **Purpose:** Immediate notification for security issues

---

### Security & Access Control

**Role-Based Access:**
- Examiners can only verify identity for assigned sheets
- Moderators and controllers can verify any sheet
- All verification attempts logged with verifier identity

**Privacy Protection:**
- Student identity still NEVER exposed via API
- Alerts use anonymized sheet IDs
- Face descriptors stored separately in identityMap

**Audit Trail:**
- Complete verification history preserved
- Cannot be modified or deleted
- Includes confidence scores and reasons
- Verifier identity and timestamp recorded

---

### Use Cases

**Use Case 1: Routine Identity Verification**
```
1. Examiner reviews student's webcam feed
2. Compares to reference photo
3. Submits verification: result=pass, confidence=0.95
4. Sheet marked as verified
5. No alerts created
```

**Use Case 2: Identity Mismatch Detected**
```
1. Examiner reviews student's webcam feed
2. Face does not match reference
3. Submits verification: result=fail, confidence=0.35, reason="Different person"
4. HIGH severity alert created immediately
5. Controller receives real-time notification
6. Controller investigates:
   - Reviews webcam footage
   - Contacts proctor
   - Verifies with exam center
7. If confirmed impersonation:
   - Exam invalidated
   - Student disciplinary action
   - Alert resolved with detailed notes
```

**Use Case 3: Multiple Verification Attempts**
```
1. Initial verification: pass (confidence 0.88)
2. Mid-exam check: pass (confidence 0.92)
3. Final check: fail (confidence 0.45)
4. History shows confidence drop
5. Controller reviews timeline
6. Determines student was replaced mid-exam
7. Exam invalidated, investigation initiated
```

---

## Integration with Existing Systems

### Anomaly Detection
- Identity verification failures create alerts
- Alerts follow same resolution workflow
- Can be reviewed in moderation queue if sheet is flagged

### Sheet Status Flow
```
uploaded → in_progress → [identity check] → evaluated/flagged → final
                              ↓
                          (if fail) → alert created → controller notified
```

### Socket.io Events
- `identity_check_failed` is a new event type
- Targets controller room for immediate notification
- Includes full context for quick response

---

## Database Indexes

**Required Firestore Indexes:**

1. **moderation collection:**
   ```
   - sheetId (ASC)
   - moderatedBy (ASC)
   - moderatedAt (DESC)
   ```

2. **identityVerifications collection:**
   ```
   - sheetId (ASC)
   - verifiedAt (DESC)
   - result (ASC)
   ```

3. **alerts collection (if not already indexed):**
   ```
   - type (ASC), status (ASC)
   - sheetId (ASC), severity (ASC)
   ```

---

## API Summary

### Moderation Routes
| Route | Method | Access | Purpose |
|-------|--------|--------|---------|
| /api/moderation/queue | GET | moderator, controller | Get flagged sheets |
| /api/moderation/:sheetId | POST | moderator, controller | Moderate sheet |

### Identity Routes
| Route | Method | Access | Purpose |
|-------|--------|--------|---------|
| /api/identity/result | POST | examiner (assigned), moderator, controller | Store verification |
| /api/identity/verifications/:sheetId | GET | examiner (assigned), moderator, controller | Get history |

---

## Testing

### Test Moderation Queue

1. **Seed data with flagged sheet:**
   ```bash
   npm run seed
   # Creates sheets with planted anomalies
   ```

2. **Get moderation queue:**
   ```bash
   curl http://localhost:5000/api/moderation/queue \
     -H "Authorization: Bearer <moderator-token>"
   ```

3. **Approve a flagged sheet:**
   ```bash
   curl -X POST http://localhost:5000/api/moderation/sheet-id \
     -H "Authorization: Bearer <moderator-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "approve",
       "reason": "Reviewed and approved"
     }'
   ```

4. **Adjust marks:**
   ```bash
   curl -X POST http://localhost:5000/api/moderation/sheet-id \
     -H "Authorization: Bearer <moderator-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "adjust",
       "reason": "Question 3 was actually answered",
       "adjustedMarks": [
         {"qNo": 3, "marks": 5, "comment": "Graded now"}
       ]
     }'
   ```

5. **Send back to examiner:**
   ```bash
   curl -X POST http://localhost:5000/api/moderation/sheet-id \
     -H "Authorization: Bearer <moderator-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "sendback",
       "reason": "Needs re-evaluation of question 2"
     }'
   ```

### Test Identity Verification

1. **Submit pass result:**
   ```bash
   curl -X POST http://localhost:5000/api/identity/result \
     -H "Authorization: Bearer <examiner-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "sheetId": "sheet-id",
       "result": "pass",
       "confidence": 0.95
     }'
   ```

2. **Submit fail result (creates alert):**
   ```bash
   curl -X POST http://localhost:5000/api/identity/result \
     -H "Authorization: Bearer <examiner-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "sheetId": "sheet-id",
       "result": "fail",
       "confidence": 0.42,
       "reason": "Face does not match reference"
     }'
   ```

3. **Get verification history:**
   ```bash
   curl http://localhost:5000/api/identity/verifications/sheet-id \
     -H "Authorization: Bearer <examiner-token>"
   ```

4. **Listen for identity_check_failed event:**
   ```javascript
   socket.on('identity_check_failed', (data) => {
     console.log('Identity check failed:', data);
     // Show alert to controller
     // Trigger investigation workflow
   });
   ```

---

**Version:** 1.0.0  
**Last Updated:** 2026-09-30  
**Status:** Complete ✅
