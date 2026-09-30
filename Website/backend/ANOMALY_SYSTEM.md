# Anomaly Detection System Documentation

## Overview

The anomaly detection system automatically identifies suspicious patterns and issues during the marking process. It runs checks at two stages:
1. **Quick checks** when saving individual question marks
2. **Full checks** when submitting a completed sheet

---

## Anomaly Types

### A1: Unmarked Question (HIGH severity)

**Description:** One or more questions in the exam have not been marked.

**Detection:** On sheet submission

**Example:**
```json
{
  "type": "A1_UNMARKED_QUESTION",
  "severity": "high",
  "message": "Question 3 is unmarked",
  "metadata": {
    "questionNo": 3,
    "maxMarks": 12
  }
}
```

**Action:** Sheet is flagged, moderator review required

---

### A3: Marks Exceed Maximum (HIGH severity)

**Description:** Marks awarded for a question exceed the maximum marks defined for that question.

**Detection:** 
- Quick check when saving marks
- Full check on submission

**Example:**
```json
{
  "type": "A3_MARKS_EXCEED_MAX",
  "severity": "high",
  "message": "Marks for Q2 (18) exceed maximum (15)",
  "metadata": {
    "questionNo": 2,
    "marksGiven": 18,
    "maxMarks": 15,
    "difference": 3
  }
}
```

**Action:** 
- Mark save is **rejected** (400 error)
- Sheet flagged if somehow persisted
- Moderator review required

---

### A4: Total Mismatch (HIGH severity)

**Description:** Client-provided total differs from server-calculated total.

**Detection:** On sheet submission (if client provides total)

**Example:**
```json
{
  "type": "A4_TOTAL_MISMATCH",
  "severity": "high",
  "message": "Client total (88) differs from server total (85)",
  "metadata": {
    "clientTotal": 88,
    "serverTotal": 85,
    "difference": 3
  }
}
```

**Action:** Sheet flagged, moderator review required

**Note:** Currently not enforced as we never accept client totals. Future implementation may use this for validation.

---

### A5: Time Anomaly (MEDIUM severity)

**Description:** Question marked too quickly (less than 25% of median marking time).

**Detection:** On sheet submission

**Configuration:**
```javascript
TIME_SPENT_MULTIPLIER: 0.25  // Flag if < 25% of median
MIN_TIME_THRESHOLD: 30       // Don't flag very quick marks
```

**Example:**
```json
{
  "type": "A5_TIME_ANOMALY",
  "severity": "medium",
  "message": "Q5 marked too quickly (45s vs median 180s)",
  "metadata": {
    "questionNo": 5,
    "timeSpent": 45,
    "medianTime": 180,
    "threshold": 45,
    "percentageOfMedian": 25
  }
}
```

**Action:** Sheet remains evaluated (not flagged), but alert logged for review

---

### Window Blur / Suspicious Pattern (LOW severity)

**Description:** Examiner-reported violations (e.g., student looked away from screen, suspicious behavior).

**Detection:** Manual report by examiner

**Example:**
```json
{
  "type": "WINDOW_BLUR",
  "severity": "low",
  "message": "Student looked away from screen multiple times",
  "metadata": {
    "reportedBy": "examiner-uid",
    "timestamp": "2026-09-29T12:00:00.000Z"
  }
}
```

**Action:** Alert logged, no automatic flagging

---

## Status Flow with Anomaly Detection

```
uploaded
    ↓
in_progress  
    ↓
    ├─→ evaluated (no high-severity alerts)
    └─→ flagged (has high-severity alerts)
         ↓
         └─→ verified (after moderator review)
```

---

## Alert API

### GET /api/alerts

Get alerts with filters.

**Access:** moderator, controller

**Query Parameters:**
- `type` (optional): Filter by anomaly type
- `severity` (optional): Filter by severity (high, medium, low)
- `status` (optional): Filter by alert status (pending, resolved, dismissed)
- `sheetId` (optional): Filter by sheet ID

**Example:**
```bash
GET /api/alerts?severity=high&status=pending
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-id",
      "sheetId": "sheet-id",
      "type": "A1_UNMARKED_QUESTION",
      "severity": "high",
      "message": "Question 3 is unmarked",
      "metadata": {...},
      "status": "pending",
      "detectedBy": "examiner-uid",
      "detectedAt": "2026-09-29T12:00:00.000Z"
    }
  ]
}
```

---

### POST /api/alerts/violation

Report a violation (low severity).

**Access:** examiner (assigned sheets only), moderator, controller

**Request Body:**
```json
{
  "sheetId": "sheet-id",
  "type": "WINDOW_BLUR",
  "message": "Student appeared distracted",
  "metadata": {
    "duration": "30 seconds",
    "frequency": "3 times"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert-id",
    "sheetId": "sheet-id",
    "type": "WINDOW_BLUR",
    "severity": "low",
    "message": "Student appeared distracted",
    "status": "pending",
    "detectedAt": "2026-09-29T12:00:00.000Z"
  }
}
```

---

### POST /api/alerts/:id/resolve

Resolve an alert.

**Access:** moderator, controller

**Request Body:**
```json
{
  "note": "Reviewed marking. Discrepancy was due to partial credit awarded correctly per rubric."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert-id",
    "status": "resolved",
    "resolvedBy": "moderator-uid",
    "resolvedAt": "2026-09-29T13:00:00.000Z",
    "resolutionNote": "Reviewed marking. Discrepancy..."
  }
}
```

---

### GET /api/alerts/summary

Get alert summary statistics.

**Access:** moderator, controller

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "bySeverity": {
      "high": 3,
      "medium": 8,
      "low": 4
    },
    "byType": {
      "A1_UNMARKED_QUESTION": 1,
      "A3_MARKS_EXCEED_MAX": 2,
      "A5_TIME_ANOMALY": 8,
      "WINDOW_BLUR": 4
    }
  }
}
```

---

## Configuration

Thresholds are defined in `src/config/anomalyThresholds.js`:

```javascript
const ANOMALY_THRESHOLDS = {
  // A5: Time spent anomaly detection
  TIME_SPENT_MULTIPLIER: 0.25, // Flag if time < 25% of median
  
  // Minimum time to flag (seconds)
  MIN_TIME_THRESHOLD: 30,
  
  // Alert severity levels
  SEVERITY: {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  }
};
```

To adjust sensitivity:
- **Increase `TIME_SPENT_MULTIPLIER`** → More lenient (fewer time anomalies)
- **Decrease `TIME_SPENT_MULTIPLIER`** → More strict (more time anomalies)
- **Increase `MIN_TIME_THRESHOLD`** → Ignore very quick marks

---

## Integration with Sheet Submission

When submitting a sheet:

1. **Recalculate total marks** on server
2. **Run full anomaly check**:
   - A1: Check for unmarked questions
   - A3: Check marks don't exceed max
   - A5: Check for time anomalies
3. **Store alerts** in Firestore
4. **Determine status**:
   - **Flagged** if any HIGH severity alerts
   - **Evaluated** if only MEDIUM/LOW alerts or no alerts
5. **Return alerts** in response
6. **Emit socket events**:
   - `anomaly_alert` to examiner, moderator, controller
   - `moderation_needed` to moderator (if flagged)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "sheet-id",
    "sheetId": "SHEET-abc123",
    "status": "flagged",
    "totalMarks": 85,
    "maxMarks": 100,
    "completedAt": "2026-09-29T12:00:00.000Z",
    "alerts": [
      {
        "type": "A1_UNMARKED_QUESTION",
        "severity": "high",
        "message": "Question 3 is unmarked"
      }
    ],
    "flagged": true
  }
}
```

---

## Socket.io Real-Time Updates

### anomaly_alert

Emitted when alerts are detected.

**Recipients:** 
- Examiner (who marked the sheet)
- Moderator
- Controller

**Payload:**
```json
{
  "sheetId": "sheet-doc-id",
  "anonymizedId": "SHEET-abc123",
  "alerts": [...],
  "severity": "high",
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

---

## Moderator Workflow

1. **Receive moderation_needed event** when sheet is flagged
2. **View flagged sheets**: `GET /api/sheets?status=flagged`
3. **Review sheet details**: `GET /api/sheets/:id`
4. **Check alerts**: `GET /api/alerts?sheetId=:id&status=pending`
5. **Review marks and make corrections** if needed
6. **Resolve alerts**: `POST /api/alerts/:id/resolve`
7. **Update sheet status** to `verified` (future implementation)

---

## Testing

### Test Case 1: Unmarked Question

```bash
# Submit sheet without marking all questions
POST /api/sheets/:id/submit

# Expected: Status = flagged, alert A1 created
```

### Test Case 2: Marks Exceed Max

```bash
# Try to save marks > maxMarks
PUT /api/sheets/:id/marks/1
Body: {"marks": 20}  # If maxMarks is 10

# Expected: 400 Bad Request, no mark saved
```

### Test Case 3: Time Anomaly

```bash
# Mark multiple questions very quickly
PUT /api/sheets/:id/marks/1
Body: {"marks": 8, "timeSpentSec": 10}

PUT /api/sheets/:id/marks/2
Body: {"marks": 12, "timeSpentSec": 15}

# Submit
POST /api/sheets/:id/submit

# Expected: A5 alerts for quick marking, status = evaluated (not flagged)
```

### Test Case 4: Report Violation

```bash
# Examiner reports suspicious behavior
POST /api/alerts/violation
Body: {
  "sheetId": "sheet-id",
  "type": "WINDOW_BLUR",
  "message": "Student looked away"
}

# Expected: Low severity alert created, no flagging
```

---

## Future Enhancements

1. **Historical Analysis**
   - Track examiner marking patterns over time
   - Identify consistent anomalies

2. **Machine Learning**
   - Learn normal marking patterns
   - Detect subtle anomalies

3. **Calibration Sheets**
   - Compare marks against known correct answers
   - Measure examiner accuracy

4. **Auto-Resolution**
   - Automatically resolve certain low-risk alerts
   - Focus moderator attention on critical issues

5. **Customizable Thresholds**
   - Per-exam configuration
   - Per-examiner adjustments

---

## Alert Collection Schema

```javascript
{
  id: "auto-generated",
  sheetId: "sheet-doc-id",
  type: "A1_UNMARKED_QUESTION" | "A3_MARKS_EXCEED_MAX" | "A4_TOTAL_MISMATCH" | 
        "A5_TIME_ANOMALY" | "WINDOW_BLUR" | "SUSPICIOUS_PATTERN",
  severity: "high" | "medium" | "low",
  message: "Human-readable description",
  metadata: {
    // Type-specific data
  },
  status: "pending" | "resolved" | "dismissed",
  detectedBy: "user-uid",
  detectedAt: "2026-09-29T12:00:00.000Z",
  resolvedBy: "user-uid" | null,
  resolvedAt: "2026-09-29T13:00:00.000Z" | null,
  resolutionNote: "Resolution explanation" | null
}
```

---

**Last Updated:** September 2026  
**Version:** 1.0.0
