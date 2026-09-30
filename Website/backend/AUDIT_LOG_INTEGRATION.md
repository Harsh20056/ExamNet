# Audit Log Integration Guide

## Overview

The audit log system uses blockchain-style chaining to create a tamper-evident record of all critical operations. Each entry contains a hash that includes the previous entry's hash, making it impossible to modify past entries without detection.

---

## Implementation Status

### ✅ Completed
- `src/services/auditLog.js` - Core audit service with append(), verify(), search()
- `src/routes/audit.js` - API routes for searching and verification
- Routes mounted in server.js

### 🔄 Integration Points (Need to add auditLog.append() calls)

The following operations need audit logging. Add `req.user.role` to function signatures where needed.

---

## 1. Sheet Upload
**File:** `src/routes/sheets.js` - POST /api/sheets/upload  
**Service:** `src/services/sheetService.js` - createSheet()

**Add to createSheet:**
```javascript
await auditLog.append({
  actor: uploadedBy,
  role: uploaderRole, // Add parameter
  action: 'upload',
  sheetId: docRef.id,
  before: null,
  after: {
    sheetId: anonymizedSheetId,
    examId,
    status: 'uploaded',
    pageCount: pages.length
  },
  metadata: { rollNo } // OK in audit (controller-only access)
});
```

---

## 2. Sheet Assignment
**Service:** `src/services/sheetService.js` - assignSheet()

**Add:**
```javascript
const before = await getSheetById(sheetId);

// ... update ...

await auditLog.append({
  actor: assignerId, // Add parameter
  role: assignerRole, // Add parameter
  action: 'assign',
  sheetId,
  before: { assignedTo: before.assignedTo },
  after: { assignedTo: examinerId }
});
```

---

## 3. Start Marking
**Service:** `src/services/sheetService.js` - startMarking()

**Add:**
```javascript
const before = await getSheetById(sheetId);

// ... update ...

await auditLog.append({
  actor: examinerId,
  role: examinerRole, // Add parameter
  action: 'start',
  sheetId,
  before: { status: before.status },
  after: { status: 'in_progress', startedAt: updates.startedAt }
});
```

---

## 4. Mark Save
**Service:** `src/services/sheetService.js` - saveQuestionMarks()

**Add:**
```javascript
// Get existing mark if any
const before = await db.collection('marks').doc(markDocId).get();

// ... save ...

await auditLog.append({
  actor: markedBy,
  role: markerRole, // Add to markData parameter
  action: 'mark_save',
  sheetId,
  before: before.exists ? { qNo: before.data().qNo, marks: before.data().marks } : null,
  after: { qNo, marks },
  metadata: { timeSpentSec }
});
```

---

## 5. Submit Sheet
**Service:** `src/services/sheetService.js` - submitSheet()

**Add:**
```javascript
const before = await getSheetById(sheetId);

// ... anomaly detection and submit ...

await auditLog.append({
  actor: submittedBy,
  role: submitterRole, // Add parameter
  action: 'submit',
  sheetId,
  before: { status: before.status, totalMarks: before.totalMarks },
  after: { status: updatedSheet.status, totalMarks: updatedSheet.totalMarks },
  metadata: {
    alertCount: storedAlerts.length,
    flagged: hasCriticalAlerts
  }
});
```

---

## 6. AI Evaluate
**File:** `src/routes/ai.js` - POST /api/ai/evaluate

**Add after successful evaluation:**
```javascript
await auditLog.append({
  actor: req.user.uid,
  role: req.user.role,
  action: 'ai_evaluate',
  sheetId,
  before: null,
  after: {
    qNo,
    suggestedMarks: result.suggestedMarks,
    confidence: result.confidence
  },
  metadata: {
    callId: result.callId,
    source: result.source
  }
});
```

---

## 7. AI Decision
**File:** `src/routes/ai.js` - POST /api/ai/decision

**Add after storing decision:**
```javascript
await auditLog.append({
  actor: req.user.uid,
  role: req.user.role,
  action: 'ai_decision',
  sheetId: null, // Can get from aiCall if needed
  before: null,
  after: {
    decision: result.decision.type,
    finalMarks: result.decision.finalMarks
  },
  metadata: {
    aiCallId,
    note: note
  }
});
```

---

## 8. Alert Create
**Service:** `src/services/anomalyEngine.js` - storeAlerts()

**Add for each alert:**
```javascript
await auditLog.append({
  actor: detectedBy,
  role: 'system', // Or get from context
  action: 'alert_create',
  sheetId,
  before: null,
  after: {
    alertType: alert.type,
    severity: alert.severity
  },
  metadata: alert.metadata
});
```

---

## 9. Alert Resolve
**File:** `src/routes/alerts.js` - POST /api/alerts/:id/resolve

**Add after resolving:**
```javascript
await auditLog.append({
  actor: req.user.uid,
  role: req.user.role,
  action: 'alert_resolve',
  sheetId: alert.sheetId,
  before: { status: 'open' },
  after: { status: 'resolved' },
  metadata: {
    alertId: req.params.id,
    alertType: alert.type,
    note: req.body.note
  }
});
```

---

## 10. Moderation
**File:** `src/routes/moderation.js` - POST /api/moderation/:sheetId

**Add after moderation action:**
```javascript
await auditLog.append({
  actor: req.user.uid,
  role: req.user.role,
  action: 'moderation',
  sheetId,
  before: {
    status: sheet.status,
    totalMarks: sheet.totalMarks,
    marks: beforeMarks
  },
  after: {
    status: newStatus,
    totalMarks: newTotal,
    marks: afterMarks
  },
  metadata: {
    moderationAction: action,
    reason: reason
  }
});
```

---

## 11. Identity Result
**File:** `src/routes/identity.js` - POST /api/identity/result

**Add after storing verification:**
```javascript
await auditLog.append({
  actor: req.user.uid,
  role: req.user.role,
  action: 'identity_result',
  sheetId,
  before: null,
  after: {
    result,
    confidence
  },
  metadata: {
    reason,
    verificationId: verificationDoc.id
  }
});
```

---

## API Usage

### Search Audit Log
```bash
curl "http://localhost:5000/api/audit?action=submit&limit=50" \
  -H "Authorization: Bearer <controller-token>"
```

**Query Parameters:**
- `actor` - Filter by user UID
- `action` - Filter by action type
- `sheetId` - Filter by sheet ID
- `startDate` - Filter by start date (ISO)
- `endDate` - Filter by end date (ISO)
- `limit` - Max results (default 100)

---

### Verify Audit Log
```bash
curl http://localhost:5000/api/audit/verify \
  -H "Authorization: Bearer <controller-token>"
```

**Response (OK):**
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "message": "All audit entries verified successfully",
    "totalEntries": 1523,
    "verifiedEntries": 1523,
    "firstEntry": "2026-09-20T10:00:00.000Z",
    "lastEntry": "2026-09-30T16:00:00.000Z"
  }
}
```

**Response (Invalid):**
```json
{
  "success": true,
  "data": {
    "status": "INVALID",
    "message": "Hash mismatch: entry has been tampered with",
    "failedEntry": {
      "id": "doc-id",
      "seq": 234,
      "expectedHash": "abc123...",
      "actualHash": "def456...",
      "action": "submit",
      "actor": "examiner-uid"
    },
    "totalEntries": 1523,
    "verifiedEntries": 233
  }
}
```

---

### Get Statistics
```bash
curl http://localhost:5000/api/audit/statistics \
  -H "Authorization: Bearer <controller-token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEntries": 1523,
    "actionCounts": {
      "upload": 150,
      "assign": 150,
      "start": 145,
      "mark_save": 1100,
      "submit": 125,
      "ai_evaluate": 300,
      "ai_decision": 280,
      "moderation": 15
    },
    "actorCounts": {
      "controller-uid": 165,
      "examiner1-uid": 420,
      "examiner2-uid": 398
    },
    "firstEntry": "2026-09-20T10:00:00.000Z",
    "lastEntry": "2026-09-30T16:00:00.000Z"
  }
}
```

---

## Security Features

### Blockchain-Style Chaining
Each entry contains:
- `seq` - Sequential number (1, 2, 3...)
- `prevHash` - Hash of previous entry (or 'GENESIS' for first)
- `hash` - SHA256 of current entry + prevHash

**Properties:**
- Tampering with any entry breaks the chain
- Cannot insert entries without detection
- Cannot delete entries without detection
- Cannot reorder entries without detection

### Write-Only for Backend
- Firestore rules should deny client writes to `audit` collection
- Only backend service can append entries
- Controllers can read but not modify

### Verification
- `verify()` recomputes all hashes in sequence
- Detects any modification immediately
- Returns first entry that fails verification

---

## Testing

### Manual Test Sequence

1. **Create some audit entries:**
   ```bash
   # Upload a sheet
   curl -X POST http://localhost:5000/api/sheets/upload \
     -H "Authorization: Bearer <controller-token>" \
     -F "rollNo=TEST001" \
     -F "studentName=Test Student" \
     -F "examId=exam-id" \
     -F "pages=@test.jpg"
   
   # Start marking
   curl -X POST http://localhost:5000/api/sheets/SHEET_ID/start \
     -H "Authorization: Bearer <examiner-token>"
   ```

2. **Verify chain is valid:**
   ```bash
   curl http://localhost:5000/api/audit/verify \
     -H "Authorization: Bearer <controller-token>"
   # Should return status: "OK"
   ```

3. **Search audit log:**
   ```bash
   curl "http://localhost:5000/api/audit?action=upload&limit=10" \
     -H "Authorization: Bearer <controller-token>"
   ```

4. **Test tampering detection (manual):**
   - Manually edit an entry in Firestore console
   - Change a field value
   - Run verify again
   - Should return status: "INVALID" with failed entry details

---

## Firestore Rules

Add to firestore.rules:

```javascript
match /audit/{document} {
  // Only backend can write
  allow read: if request.auth != null && 
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'controller';
  allow write: if false; // Backend only via Admin SDK
}
```

---

## Performance Considerations

### Transactions
- `append()` uses Firestore transactions for sequential consistency
- Ensures `seq` numbers are always sequential
- Prevents race conditions on concurrent writes

### Indexing
Create these Firestore indexes:
```
Collection: audit
- seq (ascending)
- actor (ascending) + seq (descending)
- action (ascending) + seq (descending)
- sheetId (ascending) + seq (descending)
- ts (ascending)
```

### Verification
- `verify()` reads all entries - can be slow for large logs
- Consider running verification:
  - On-demand (via API)
  - Scheduled (daily background job)
  - After suspicious activity detected

---

## Benefits

### Compliance
- ✅ Immutable audit trail
- ✅ Tamper detection
- ✅ Complete action history
- ✅ Actor accountability

### Security
- ✅ Detects unauthorized modifications
- ✅ Blockchain-style integrity
- ✅ Write-only for backend
- ✅ Controller-only read access

### Debugging
- ✅ Complete operation history
- ✅ Before/after state tracking
- ✅ Easy to trace sheet lifecycle
- ✅ Search and filter capabilities

---

## Next Steps

1. Add `req.user.role` to all function parameters as needed
2. Add `await auditLog.append()` calls at each integration point
3. Update Firestore security rules
4. Create indexes
5. Test verification on sample data
6. Add scheduled verification job (optional)

---

**Status:** Core system complete, integration in progress  
**Version:** 1.0.0  
**Last Updated:** 2026-09-30
