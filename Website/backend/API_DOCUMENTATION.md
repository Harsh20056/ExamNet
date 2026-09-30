# API Documentation - Firestore Backend

## Overview

This document describes the Firestore-backed API endpoints for the SAMADHAN X exam management system.

**Key Features:**
- Firebase authentication required for all routes
- Role-based access control (examiner, moderator, controller)
- Anonymized answer sheets (identity never exposed)
- Server-side mark calculation
- Automatic timestamp management (ISO 8601 UTC)

---

## Authentication

All routes require a Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

The token is verified using Firebase Admin SDK, and the user's role is loaded from Firestore (`users/{uid}`).

### User Roles

- **examiner** - Marks assigned answer sheets
- **moderator** - Reviews and moderates marked sheets
- **controller** - Full system access (exam creation, sheet upload, user management)

---

## Data Collections

### Firestore Collections

1. **exams** - Exam definitions with questions
2. **sheets** - Answer sheets (anonymized, no student identity)
3. **identityMap** - Student identity mapping (never exposed via API)
4. **marks** - Individual question marks for sheets
5. **users** - User profiles with roles

### Sheet Status Flow

```
uploaded → in_progress → evaluated → [flagged] → final
                                   ↓           ↗
                              (sendback) ←────┘
```

Status changes are controlled by specific endpoints only (no free-form updates).

**Status Definitions:**
- `uploaded` - Sheet uploaded, not yet assigned or started
- `in_progress` - Examiner is actively marking
- `evaluated` - Marking complete, no high-severity anomalies
- `flagged` - Marking complete, but has high-severity anomalies requiring moderation
- `final` - Moderation complete (approved/adjusted), ready for results

---

## Exam Management

### POST /api/exams

Create a new exam.

**Access:** `controller` only

**Request Body:**
```json
{
  "title": "Midterm Examination 2026",
  "subject": "Computer Science",
  "examDate": "2026-09-29T09:00:00.000Z",
  "duration": 180,
  "instructions": "Answer all questions...",
  "questions": [
    {
      "qNo": 1,
      "maxMarks": 10,
      "text": "Explain the OSI model...",
      "modelAnswer": "The OSI model consists of 7 layers...",
      "rubric": [
        {
          "criterion": "Correct layer identification",
          "points": 3,
          "description": "Student identifies all 7 layers"
        },
        {
          "criterion": "Explanation clarity",
          "points": 4,
          "description": "Clear explanation of each layer"
        },
        {
          "criterion": "Examples provided",
          "points": 3,
          "description": "Real-world examples given"
        }
      ]
    },
    {
      "qNo": 2,
      "maxMarks": 15,
      "text": "Implement a binary search algorithm...",
      "modelAnswer": "function binarySearch(arr, target) {...}",
      "rubric": []
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "exam123",
    "title": "Midterm Examination 2026",
    "subject": "Computer Science",
    "examDate": "2026-09-29T09:00:00.000Z",
    "duration": 180,
    "instructions": "Answer all questions...",
    "questions": [...],
    "totalMaxMarks": 25,
    "createdBy": "user-uid",
    "createdAt": "2026-09-29T08:00:00.000Z",
    "updatedAt": "2026-09-29T08:00:00.000Z"
  },
  "timestamp": "2026-09-29T08:00:00.000Z"
}
```

**Validation:**
- `title`: 1-200 characters
- `subject`: 1-100 characters
- `questions`: 1-100 questions required
- Each `qNo` must be positive integer
- Each `maxMarks` must be >= 0

---

### GET /api/exams

Get all exams.

**Access:** All authenticated users (`examiner`, `moderator`, `controller`)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "exam123",
      "title": "Midterm Examination 2026",
      "subject": "Computer Science",
      "totalMaxMarks": 25,
      "createdAt": "2026-09-29T08:00:00.000Z",
      "questions": [...]
    }
  ],
  "timestamp": "2026-09-29T08:00:00.000Z"
}
```

---

### GET /api/exams/:id

Get exam by ID.

**Access:** All authenticated users

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "exam123",
    "title": "Midterm Examination 2026",
    "subject": "Computer Science",
    "totalMaxMarks": 25,
    "questions": [...],
    "createdAt": "2026-09-29T08:00:00.000Z"
  },
  "timestamp": "2026-09-29T08:00:00.000Z"
}
```

**Error Responses:**
- `404` - Exam not found

---

## Sheet Management

### POST /api/sheets/upload

Upload answer sheet page images.

**Access:** `controller` only

**Request:**
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `rollNo` (string, required): Student roll number
  - `studentName` (string, required): Student name
  - `examId` (string, required): Exam ID
  - `pages` (files, required): Image files (max 50 pages, 10MB each)

**Example using curl:**
```bash
curl -X POST http://localhost:5000/api/sheets/upload \
  -H "Authorization: Bearer <token>" \
  -F "rollNo=CS2026001" \
  -F "studentName=John Doe" \
  -F "examId=exam123" \
  -F "pages=@page1.jpg" \
  -F "pages=@page2.jpg" \
  -F "pages=@page3.jpg"
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "sheet-doc-id",
    "sheetId": "SHEET-a1b2c3d4e5",
    "examId": "exam123",
    "status": "uploaded",
    "pageCount": 3,
    "uploadedAt": "2026-09-29T10:00:00.000Z",
    "maxMarks": 25
  },
  "timestamp": "2026-09-29T10:00:00.000Z"
}
```

**Notes:**
- Student identity (`rollNo`, `studentName`) is stored in `identityMap` collection
- An anonymized `sheetId` (e.g., `SHEET-a1b2c3d4e5`) is generated
- Identity is NEVER returned by any API endpoint
- Pages are converted to base64 data URLs and stored in Firestore

**Error Responses:**
- `400` - No page images uploaded
- `400` - Invalid metadata
- `404` - Exam not found

---

### GET /api/sheets

Get sheets with optional filters.

**Access:** `controller` only

**Query Parameters:**
- `status` (optional): Filter by status (`uploaded`, `in_progress`, `evaluated`, `flagged`, `verified`)
- `examId` (optional): Filter by exam ID

**Example:**
```http
GET /api/sheets?status=uploaded&examId=exam123
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "sheet-doc-id",
      "sheetId": "SHEET-a1b2c3d4e5",
      "examId": "exam123",
      "status": "uploaded",
      "assignedTo": null,
      "uploadedAt": "2026-09-29T10:00:00.000Z",
      "startedAt": null,
      "completedAt": null,
      "totalMarks": 0,
      "maxMarks": 25,
      "pageCount": 3
    }
  ],
  "timestamp": "2026-09-29T10:05:00.000Z"
}
```

**Notes:**
- Student identity is NEVER included
- Returns anonymized `sheetId` only

---

### GET /api/sheets/mine

Get sheets assigned to current examiner.

**Access:** `examiner` only

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "sheet-doc-id",
      "sheetId": "SHEET-a1b2c3d4e5",
      "examId": "exam123",
      "status": "in_progress",
      "startedAt": "2026-09-29T11:00:00.000Z",
      "completedAt": null,
      "totalMarks": 15,
      "maxMarks": 25,
      "pageCount": 3
    }
  ],
  "timestamp": "2026-09-29T11:30:00.000Z"
}
```

---

### GET /api/sheets/:id

Get detailed sheet information with exam definition and marks.

**Access:**
- `examiner` - Only if sheet is assigned to them (`sheet.assignedTo === req.user.uid`)
- `moderator` - All sheets
- `controller` - All sheets

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "sheet-doc-id",
    "sheetId": "SHEET-a1b2c3d4e5",
    "examId": "exam123",
    "status": "in_progress",
    "assignedTo": "examiner-uid",
    "pages": [
      {
        "pageNumber": 1,
        "fileName": "page1.jpg",
        "mimeType": "image/jpeg",
        "size": 245678,
        "dataUrl": "data:image/jpeg;base64,/9j/4AAQ..."
      }
    ],
    "startedAt": "2026-09-29T11:00:00.000Z",
    "completedAt": null,
    "totalMarks": 15,
    "maxMarks": 25,
    "exam": {
      "id": "exam123",
      "title": "Midterm Examination 2026",
      "subject": "Computer Science",
      "questions": [...]
    },
    "marks": [
      {
        "qNo": 1,
        "marks": 8,
        "comment": "Good explanation but missing examples",
        "timeSpentSec": 120,
        "markedAt": "2026-09-29T11:15:00.000Z"
      },
      {
        "qNo": 2,
        "marks": 12,
        "comment": "Excellent implementation",
        "timeSpentSec": 180,
        "markedAt": "2026-09-29T11:20:00.000Z"
      }
    ]
  },
  "timestamp": "2026-09-29T11:30:00.000Z"
}
```

**Notes:**
- Student identity is NEVER included
- Pages include base64 data URLs for rendering
- Current marks are included for all marked questions

**Error Responses:**
- `403` - Examiner accessing non-assigned sheet
- `404` - Sheet not found
- `404` - Associated exam not found

---

### POST /api/sheets/:id/start

Start marking a sheet (changes status to `in_progress`).

**Access:**
- `examiner` - Only if sheet is assigned to them
- `moderator` - All sheets
- `controller` - All sheets

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "sheet-doc-id",
    "sheetId": "SHEET-a1b2c3d4e5",
    "status": "in_progress",
    "startedAt": "2026-09-29T11:00:00.000Z"
  },
  "timestamp": "2026-09-29T11:00:00.000Z"
}
```

**Error Responses:**
- `400` - Sheet already in progress or completed
- `403` - Examiner accessing non-assigned sheet
- `404` - Sheet not found

---

### PUT /api/sheets/:id/marks/:qNo

Save marks for a specific question.

**Access:**
- `examiner` - Only if sheet is assigned to them
- `moderator` - All sheets
- `controller` - All sheets

**Request Body:**
```json
{
  "marks": 8,
  "comment": "Good explanation but missing examples",
  "timeSpentSec": 120
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "qNo": 1,
    "marks": 8,
    "comment": "Good explanation but missing examples",
    "totalMarks": 20,
    "maxMarks": 25,
    "markedAt": "2026-09-29T11:15:00.000Z"
  },
  "timestamp": "2026-09-29T11:15:00.000Z"
}
```

**Notes:**
- Server validates `marks <= question.maxMarks`
- Server recalculates `totalMarks` automatically
- Client-provided totals are NEVER accepted

**Validation:**
- `marks` must be >= 0
- `marks` must be <= question's `maxMarks`
- `comment` max 2000 characters
- `timeSpentSec` must be >= 0

**Error Responses:**
- `400` - Marks exceed question maximum
- `403` - Examiner accessing non-assigned sheet
- `404` - Sheet not found
- `404` - Question not found in exam

---

### POST /api/sheets/:id/submit

Submit sheet as evaluated (changes status to `evaluated`).

**Access:**
- `examiner` - Only if sheet is assigned to them
- `moderator` - All sheets
- `controller` - All sheets

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "sheet-doc-id",
    "sheetId": "SHEET-a1b2c3d4e5",
    "status": "evaluated",
    "totalMarks": 20,
    "maxMarks": 25,
    "completedAt": "2026-09-29T11:45:00.000Z"
  },
  "timestamp": "2026-09-29T11:45:00.000Z"
}
```

**Notes:**
- Server recalculates total marks before submitting
- Status changes from `in_progress` to `evaluated`
- `completedAt` timestamp is set

**Error Responses:**
- `400` - Sheet not in progress
- `403` - Examiner accessing non-assigned sheet
- `404` - Sheet not found

---

## AI Evaluation

### POST /api/ai/evaluate

Request AI evaluation for a student's answer.

**Access:**
- `examiner` - Only for assigned sheets
- `moderator` - All sheets
- `controller` - All sheets

**Rate Limit:** 30 requests per 15 minutes per user (controllers exempt for testing)

**Request Body:**
```json
{
  "sheetId": "sheet-doc-id",
  "qNo": 1
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "callId": "ai-call-doc-id",
    "suggestedMarks": 8,
    "matched": [
      "Correct layer identification",
      "Explanation clarity"
    ],
    "missed": [
      "Examples provided"
    ],
    "transcription": "The OSI model consists of 7 layers: Physical, Data Link, Network...",
    "confidence": 0.87,
    "reason": "Answer demonstrates good understanding but lacks practical examples",
    "source": "ai_api",
    "processingTimeMs": 2341,
    "maxMarks": 10
  },
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Notes:**
- Images are automatically resized to 1024px width max before sending to AI
- Results are cached by (sheetId, qNo, imageHash) to avoid duplicate API calls
- If `USE_CACHED_AI=true`, pre-generated results from `cachedAIResults.json` are used
- Source can be: `ai_api` (fresh call), `cache` (database cache), or `cached_file` (demo mode)

**Error Responses:**
- `400` - No pages found in sheet
- `403` - Examiner accessing non-assigned sheet
- `404` - Sheet not found
- `404` - Question not found
- `429` - Rate limit exceeded (30 requests per 15 minutes)
- `503` - AI service unavailable

**503 Response Format:**
```json
{
  "success": false,
  "error": "AI service unavailable",
  "message": "AI evaluation service is currently unavailable",
  "callId": "ai-call-doc-id",
  "retryCount": 2,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

---

### POST /api/ai/decision

Store examiner's decision on AI suggestion (accept or override).

**Access:**
- `examiner` - For assigned sheets
- `moderator` - All sheets
- `controller` - All sheets

**Request Body (Accept):**
```json
{
  "aiCallId": "ai-call-doc-id",
  "decision": "accepted",
  "note": "AI suggestion is accurate and fair"
}
```

**Request Body (Override):**
```json
{
  "aiCallId": "ai-call-doc-id",
  "decision": "overridden",
  "overrideMarks": 9,
  "note": "AI undervalued the practical understanding shown"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "aiCallId": "ai-call-doc-id",
    "decision": "overridden",
    "finalMarks": 9,
    "note": "AI undervalued the practical understanding shown",
    "decidedAt": "2026-09-29T12:05:00.000Z"
  },
  "timestamp": "2026-09-29T12:05:00.000Z"
}
```

**Validation:**
- `decision` must be either `"accepted"` or `"overridden"`
- If `decision` is `"overridden"`, `overrideMarks` is required
- `overrideMarks` must be >= 0
- `note` is required (1-1000 characters)

**Error Responses:**
- `400` - Missing required fields
- `400` - overrideMarks required for overridden decision
- `404` - AI call not found

**Notes:**
- This endpoint does NOT update the sheet marks directly
- Examiner must still call `PUT /api/sheets/:id/marks/:qNo` to save final marks
- Decision is stored for audit and AI improvement purposes

---

### GET /api/ai/calls/:sheetId

Get all AI evaluation calls for a sheet.

**Access:**
- `examiner` - Only for assigned sheets
- `moderator` - All sheets
- `controller` - All sheets

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "ai-call-doc-id-1",
      "qNo": 1,
      "status": "success",
      "response": {
        "suggestedMarks": 8,
        "matched": ["Correct layer identification"],
        "missed": ["Examples provided"],
        "transcription": "The OSI model...",
        "confidence": 0.87,
        "reason": "Good understanding but lacks examples"
      },
      "decision": {
        "type": "overridden",
        "finalMarks": 9,
        "note": "Undervalued practical understanding",
        "decidedBy": "examiner-uid",
        "decidedAt": "2026-09-29T12:05:00.000Z"
      },
      "createdAt": "2026-09-29T12:00:00.000Z",
      "processingTimeMs": 2341
    },
    {
      "id": "ai-call-doc-id-2",
      "qNo": 2,
      "status": "success",
      "response": {
        "suggestedMarks": 14,
        "matched": ["Algorithm correctness", "Code efficiency"],
        "missed": [],
        "transcription": "function binarySearch...",
        "confidence": 0.92,
        "reason": "Excellent implementation"
      },
      "decision": null,
      "createdAt": "2026-09-29T12:10:00.000Z",
      "processingTimeMs": 1890
    }
  ],
  "timestamp": "2026-09-29T12:15:00.000Z"
}
```

**Error Responses:**
- `403` - Examiner accessing non-assigned sheet
- `404` - Sheet not found

**Notes:**
- Returns all AI calls for the sheet, newest first
- Includes both successful and failed calls
- Decision will be `null` if examiner hasn't made a decision yet

---

### AI Evaluation Workflow

1. **Examiner requests AI evaluation:**
   ```bash
   POST /api/ai/evaluate
   { "sheetId": "sheet-id", "qNo": 1 }
   ```

2. **AI returns suggestion:**
   ```json
   { "suggestedMarks": 8, "matched": [...], "missed": [...] }
   ```

3. **Examiner reviews and makes decision:**
   - **Accept:** 
     ```bash
     POST /api/ai/decision
     { "aiCallId": "call-id", "decision": "accepted", "note": "Accurate" }
     ```
   - **Override:**
     ```bash
     POST /api/ai/decision
     { "aiCallId": "call-id", "decision": "overridden", "overrideMarks": 9, "note": "Reason" }
     ```

4. **Examiner saves final marks:**
   ```bash
   PUT /api/sheets/:id/marks/1
   { "marks": 9, "comment": "Good work" }
   ```

**Important:** AI evaluation is advisory only. Examiners must always review and approve marks before saving them to the sheet.

---

## Moderation

### GET /api/moderation/queue

Get all flagged sheets awaiting moderation.

**Access:** `moderator`, `controller`

**Response:** `200 OK`
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
        {
          "qNo": 1,
          "marks": 8,
          "comment": "Good work",
          "markedAt": "2026-09-29T14:15:00.000Z"
        }
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
  ],
  "timestamp": "2026-09-29T15:00:00.000Z"
}
```

**Notes:**
- Only returns sheets with `status: 'flagged'`
- Includes HIGH severity alerts with details
- Ordered by completedAt descending (newest first)

---

### POST /api/moderation/:sheetId

Perform moderation action on a flagged sheet.

**Access:** `moderator`, `controller`

**Actions:**
- `approve` - Accept examiner's marks without changes, set status to `final`
- `adjust` - Modify marks and set status to `final`
- `sendback` - Return to examiner for re-marking, set status to `in_progress`

**Request Body (Approve):**
```json
{
  "action": "approve",
  "reason": "Marks are accurate and consistent with rubric"
}
```

**Request Body (Adjust):**
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

**Request Body (Sendback):**
```json
{
  "action": "sendback",
  "reason": "Question 3 needs re-evaluation, unclear marking criteria applied"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "sheetId": "SHEET-a1b2c3d4e5",
    "action": "adjust",
    "status": "final",
    "totalMarks": 22,
    "maxMarks": 25,
    "moderatedAt": "2026-09-29T15:30:00.000Z"
  },
  "timestamp": "2026-09-29T15:30:00.000Z"
}
```

**Validation:**
- `action` must be `"approve"`, `"adjust"`, or `"sendback"`
- `reason` is required (1-2000 characters)
- If `action` is `"adjust"`, `adjustedMarks` is required
- Adjusted marks must not exceed question's `maxMarks`

**Behavior:**
- **Approve/Adjust**: 
  - Status → `final`
  - Removes sheet from moderation queue
  - Auto-resolves all HIGH severity alerts
  - Stores before/after marks in `moderation` collection
- **Sendback**:
  - Status → `in_progress`
  - Returns to examiner's queue
  - Alerts remain open
- **Socket Events**: Emits `sheet_updated` and `dashboard_tick`

**Error Responses:**
- `400` - Sheet not flagged for moderation
- `400` - Adjusted marks exceed question maximum
- `404` - Sheet not found
- `404` - Question not found in exam

---

## Identity Verification

### POST /api/identity/result

Store identity verification result for a sheet.

**Access:** `examiner` (assigned sheets only), `moderator`, `controller`

**Request Body (Pass):**
```json
{
  "sheetId": "sheet-doc-id",
  "result": "pass",
  "confidence": 0.95,
  "reason": "Face matches reference descriptor with high confidence"
}
```

**Request Body (Fail):**
```json
{
  "sheetId": "sheet-doc-id",
  "result": "fail",
  "confidence": 0.42,
  "reason": "Face does not match reference descriptor - possible impersonation"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "sheetId": "SHEET-a1b2c3d4e5",
    "result": "fail",
    "confidence": 0.42,
    "verifiedAt": "2026-09-29T16:00:00.000Z",
    "alert": "Identity check failure alert created"
  },
  "timestamp": "2026-09-29T16:00:00.000Z"
}
```

**Validation:**
- `sheetId` is required
- `result` must be `"pass"` or `"fail"`
- `confidence` is optional (0.0 to 1.0)
- `reason` is optional (1-2000 characters)

**Behavior:**
- Updates sheet with `identityVerified: true/false`
- Stores verification record in `identityVerifications` collection
- **On Failure**:
  - Creates HIGH severity alert (`type: 'identity_check_failed'`)
  - Emits `identity_check_failed` event to controller room
  - Alert includes confidence and reason

**Socket Event (on failure):**
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

**Error Responses:**
- `400` - Examiner accessing non-assigned sheet
- `404` - Sheet not found

---

### GET /api/identity/verifications/:sheetId

Get identity verification history for a sheet.

**Access:** `examiner` (assigned sheets only), `moderator`, `controller`

**Response:** `200 OK`
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
  },
  "timestamp": "2026-09-29T16:05:00.000Z"
}
```

**Notes:**
- Returns complete verification history ordered by newest first
- Shows current verification status on sheet
- Useful for audit trail and investigating identity issues

**Error Responses:**
- `400` - Examiner accessing non-assigned sheet
- `404` - Sheet not found

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

With optional `details` field for validation errors:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "marks",
      "message": "Expected number, received string",
      "code": "invalid_type"
    }
  ],
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad request (validation error, business logic error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `429` - Too many requests (rate limit exceeded)
- `500` - Internal server error

---

## Data Privacy & Security

### Identity Protection

**CRITICAL:** Student identity (`rollNo`, `studentName`) is:
- ✅ Stored in `identityMap` collection
- ❌ NEVER returned by ANY API endpoint
- ❌ NEVER accessible to examiners
- ✅ Only accessible to controllers via direct Firestore access

### Anonymization

- Every sheet gets an anonymized `sheetId` (e.g., `SHEET-a1b2c3d4e5`)
- Examiners only see the anonymized ID
- Mapping to student identity is kept separate

### Access Control Matrix

| Route | examiner | moderator | controller |
|-------|----------|-----------|------------|
| POST /api/exams | ❌ | ❌ | ✅ |
| GET /api/exams | ✅ | ✅ | ✅ |
| GET /api/exams/:id | ✅ | ✅ | ✅ |
| POST /api/sheets/upload | ❌ | ❌ | ✅ |
| GET /api/sheets | ❌ | ❌ | ✅ |
| GET /api/sheets/mine | ✅ | ❌ | ❌ |
| GET /api/sheets/:id | ✅ (assigned only) | ✅ | ✅ |
| POST /api/sheets/:id/start | ✅ (assigned only) | ✅ | ✅ |
| PUT /api/sheets/:id/marks/:qNo | ✅ (assigned only) | ✅ | ✅ |
| POST /api/sheets/:id/submit | ✅ (assigned only) | ✅ | ✅ |
| POST /api/ai/evaluate | ✅ (assigned only) | ✅ | ✅ |
| POST /api/ai/decision | ✅ (assigned only) | ✅ | ✅ |
| GET /api/ai/calls/:sheetId | ✅ (assigned only) | ✅ | ✅ |
| GET /api/moderation/queue | ❌ | ✅ | ✅ |
| POST /api/moderation/:sheetId | ❌ | ✅ | ✅ |
| POST /api/identity/result | ✅ (assigned only) | ✅ | ✅ |
| GET /api/identity/verifications/:sheetId | ✅ (assigned only) | ✅ | ✅ |

---

## Deprecated Routes

The following routes are deprecated and will be removed in a future version:

- `GET /api/students` - Use Firestore-backed sheet management
- `POST /api/students` - Use `POST /api/sheets/upload`
- `PUT /api/students/:id` - Use sheet marking routes
- `DELETE /api/students/:id` - Not applicable
- `POST /api/cheat` - Use anomaly detection (coming soon)

---

## Examples

### Complete Workflow

#### 1. Controller creates an exam
```bash
curl -X POST http://localhost:5000/api/exams \
  -H "Authorization: Bearer <controller-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Midterm Exam",
    "subject": "CS",
    "questions": [{"qNo": 1, "maxMarks": 10, "text": "Question 1"}]
  }'
```

#### 2. Controller uploads answer sheets
```bash
curl -X POST http://localhost:5000/api/sheets/upload \
  -H "Authorization: Bearer <controller-token>" \
  -F "rollNo=CS001" \
  -F "studentName=John Doe" \
  -F "examId=exam123" \
  -F "pages=@page1.jpg"
```

#### 3. Examiner sees assigned sheets
```bash
curl http://localhost:5000/api/sheets/mine \
  -H "Authorization: Bearer <examiner-token>"
```

#### 4. Examiner starts marking
```bash
curl -X POST http://localhost:5000/api/sheets/sheet-id/start \
  -H "Authorization: Bearer <examiner-token>"
```

#### 5. Examiner saves marks for questions
```bash
curl -X PUT http://localhost:5000/api/sheets/sheet-id/marks/1 \
  -H "Authorization: Bearer <examiner-token>" \
  -H "Content-Type: application/json" \
  -d '{"marks": 8, "comment": "Good work"}'
```

#### 6. Examiner submits sheet
```bash
curl -X POST http://localhost:5000/api/sheets/sheet-id/submit \
  -H "Authorization: Bearer <examiner-token>"
```

---

## Rate Limits

- **General API**: 100 requests per 15 minutes per IP
- **AI Evaluation**: 30 requests per 15 minutes per user (controllers exempt for testing)
- **File uploads**: 10MB per file, 50 files per request

---

## Timestamps

All timestamps are in **ISO 8601 format (UTC)**:
- Example: `2026-09-29T12:00:00.000Z`
- Always use server-generated timestamps
- Never accept client-provided timestamps for auditing fields

---

## Support

For issues or questions:
- Check server logs for error details
- Verify Firebase token is valid and not expired
- Ensure user has correct role in Firestore
- Review validation error details in response
