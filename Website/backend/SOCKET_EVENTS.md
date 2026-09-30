# Socket.io Real-Time Events Documentation

## Overview

The SAMADHAN X backend uses Socket.io for real-time communication with authenticated role-based rooms.

**Key Features:**
- Firebase token authentication required
- Role-based rooms (controller, moderator, examiner:{uid})
- Targeted event delivery
- Automatic reconnection handling

---

## Authentication

### Connection

Clients must provide a Firebase ID token in the connection handshake:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: firebaseIdToken  // Get from firebase.auth().currentUser.getIdToken()
  }
});

socket.on('authenticated', (data) => {
  console.log('Connected:', data);
  // { uid, role, name, timestamp }
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
  // "Authentication token required" or "Authentication failed"
});
```

### Token Verification

The server:
1. Extracts token from `socket.handshake.auth.token`
2. Verifies with Firebase Admin SDK
3. Loads user profile from Firestore
4. Validates role (examiner, moderator, controller)
5. Joins user to appropriate role-based rooms

---

## Room Structure

### Role-Based Rooms

| Role | Room Name | Purpose |
|------|-----------|---------|
| Controller | `controller` | System-wide events, dashboard updates |
| Moderator | `moderator` | Moderation requests, alerts |
| Examiner | `examiner:{uid}` | Individual examiner's assigned sheets |

**Example:**
- Examiner with UID `abc123` joins room `examiner:abc123`
- Only that specific examiner receives events for their sheets

---

## Events

### 1. sheet_assigned

**Description:** Notifies examiner when a sheet is assigned to them.

**Recipients:** Specific examiner (room: `examiner:{uid}`)

**Trigger:** When controller assigns a sheet to an examiner

**Payload:**
```json
{
  "sheetId": "sheet-doc-id",
  "anonymizedId": "SHEET-abc123",
  "examId": "exam-id",
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Client Handler:**
```javascript
socket.on('sheet_assigned', (data) => {
  console.log('New sheet assigned:', data.anonymizedId);
  // Refresh sheet list or show notification
});
```

---

### 2. sheet_updated

**Description:** Notifies when a sheet status or marks are updated.

**Recipients:** Controller, Moderator

**Trigger:** 
- Sheet status changes (uploaded → in_progress → evaluated/flagged)
- Marks are saved
- Sheet is started or submitted

**Payload:**
```json
{
  "sheetId": "sheet-doc-id",
  "anonymizedId": "SHEET-abc123",
  "status": "in_progress",
  "assignedTo": "examiner-uid",
  "questionNo": 1,  // Optional: if specific question updated
  "marks": 8,       // Optional: marks for that question
  "totalMarks": 45,
  "flagged": false,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Client Handler:**
```javascript
socket.on('sheet_updated', (data) => {
  console.log('Sheet updated:', data.anonymizedId, data.status);
  // Update UI, refresh sheet details
  if (data.flagged) {
    showFlaggedNotification(data);
  }
});
```

---

### 3. anomaly_alert

**Description:** Notifies when anomalies are detected during marking.

**Recipients:** 
- Specific examiner (who marked the sheet)
- Moderator
- Controller

**Trigger:**
- Quick check when saving marks (A3: marks exceed max)
- Full check on submission (A1, A3, A5)
- Manual violation report

**Payload:**
```json
{
  "alertId": "alert-doc-id",
  "sheetId": "sheet-doc-id",
  "anonymizedId": "SHEET-abc123",
  "type": "A1_UNMARKED_QUESTION",
  "severity": "high",
  "message": "Question 3 is unmarked",
  "alerts": [
    {
      "type": "A1_UNMARKED_QUESTION",
      "severity": "high",
      "message": "Question 3 is unmarked",
      "metadata": {...}
    }
  ],
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Client Handler:**
```javascript
socket.on('anomaly_alert', (data) => {
  console.log('Anomaly detected:', data.type, data.severity);
  
  if (data.severity === 'high') {
    showCriticalAlert(data);
  } else {
    showWarning(data);
  }
  
  // Update alert badge count
  incrementAlertCount();
});
```

---

### 4. moderation_needed

**Description:** Notifies moderator when a sheet is flagged and needs review.

**Recipients:** Moderator only

**Trigger:** Sheet submission with high-severity alerts

**Payload:**
```json
{
  "sheetId": "sheet-doc-id",
  "anonymizedId": "SHEET-abc123",
  "alertCount": 2,
  "examId": "exam-id",
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Client Handler:**
```javascript
socket.on('moderation_needed', (data) => {
  console.log('Sheet flagged for moderation:', data.anonymizedId);
  
  // Show notification
  showModerationRequest({
    sheet: data.anonymizedId,
    alerts: data.alertCount
  });
  
  // Play notification sound
  playNotificationSound();
  
  // Update moderation queue count
  refreshModerationQueue();
});
```

---

### 5. identity_check_failed

**Description:** Notifies controller when identity verification fails.

**Recipients:** Controller only

**Trigger:** Face recognition mismatch or identity validation failure (future implementation)

**Payload:**
```json
{
  "sheetId": "sheet-doc-id",
  "anonymizedId": "SHEET-abc123",
  "reason": "Face recognition confidence below threshold",
  "confidence": 0.65,
  "threshold": 0.85,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Client Handler:**
```javascript
socket.on('identity_check_failed', (data) => {
  console.log('Identity check failed:', data.anonymizedId);
  
  // Show critical alert
  showIdentityAlert({
    sheet: data.anonymizedId,
    reason: data.reason,
    confidence: data.confidence
  });
  
  // Add to investigation queue
  addToInvestigationQueue(data);
});
```

---

### 6. dashboard_tick

**Description:** Provides real-time dashboard statistics (throttled to 5 seconds).

**Recipients:** Controller only

**Trigger:** Automatic periodic updates (every 5 seconds)

**Payload:**
```json
{
  "sheetsUploaded": 5,
  "sheetsInProgress": 18,
  "sheetsEvaluated": 32,
  "sheetsFlagged": 3,
  "alertsPending": 7,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Client Handler:**
```javascript
socket.on('dashboard_tick', (data) => {
  // Update dashboard statistics
  updateDashboard({
    uploaded: data.sheetsUploaded,
    inProgress: data.sheetsInProgress,
    evaluated: data.sheetsEvaluated,
    flagged: data.sheetsFlagged,
    alerts: data.alertsPending
  });
  
  // Update charts
  updateStatusChart(data);
});
```

---

## Event Distribution Table

| Event | examiner:{uid} | moderator | controller |
|-------|----------------|-----------|------------|
| sheet_assigned | ✅ | ❌ | ❌ |
| sheet_updated | ❌ | ✅ | ✅ |
| anomaly_alert | ✅ (own sheets) | ✅ | ✅ |
| moderation_needed | ❌ | ✅ | ❌ |
| identity_check_failed | ❌ | ❌ | ✅ |
| dashboard_tick | ❌ | ❌ | ✅ |

---

## Complete Client Example

### React/TypeScript Implementation

```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { getAuth } from 'firebase/auth';

function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const initSocket = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const socketInstance = io('http://localhost:5000', {
        auth: { token }
      });
      
      socketInstance.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
      });
      
      socketInstance.on('authenticated', (data) => {
        console.log('Authenticated as:', data.role);
      });
      
      socketInstance.on('disconnect', () => {
        console.log('Socket disconnected');
        setConnected(false);
      });
      
      socketInstance.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
      });
      
      // Event handlers
      socketInstance.on('sheet_assigned', (data) => {
        console.log('Sheet assigned:', data);
        // Show notification
      });
      
      socketInstance.on('sheet_updated', (data) => {
        console.log('Sheet updated:', data);
        // Refresh data
      });
      
      socketInstance.on('anomaly_alert', (data) => {
        console.log('Anomaly alert:', data);
        // Show alert
      });
      
      socketInstance.on('moderation_needed', (data) => {
        console.log('Moderation needed:', data);
        // Update queue
      });
      
      socketInstance.on('dashboard_tick', (data) => {
        console.log('Dashboard update:', data);
        // Update stats
      });
      
      setSocket(socketInstance);
    };
    
    initSocket();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);
  
  return { socket, connected };
}

export default useSocket;
```

---

## Error Handling

### Authentication Errors

**Error:** `"Authentication token required"`
- **Cause:** No token provided in handshake
- **Fix:** Ensure `auth: { token }` is passed to `io()` constructor

**Error:** `"Authentication failed"`
- **Cause:** Invalid or expired token
- **Fix:** Refresh Firebase token and reconnect

**Error:** `"User profile not found"`
- **Cause:** User exists in Firebase Auth but not in Firestore
- **Fix:** Ensure user document exists in `users/{uid}` collection

**Error:** `"Invalid user role"`
- **Cause:** User role is not examiner, moderator, or controller
- **Fix:** Update user role in Firestore

---

## Reconnection Strategy

Socket.io automatically handles reconnection, but you can customize:

```javascript
const socket = io('http://localhost:5000', {
  auth: { token },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // Refresh token if needed
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection failed:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('Reconnection failed after max attempts');
  // Prompt user to refresh page or re-login
});
```

---

## Testing Socket Events

### Manual Testing with Socket.io Client

```javascript
// Install: npm install socket.io-client
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  auth: {
    token: 'YOUR_FIREBASE_TOKEN'
  }
});

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('authenticated', (data) => {
  console.log('Authenticated:', data);
});

socket.on('sheet_assigned', (data) => {
  console.log('Sheet assigned:', data);
});

socket.on('anomaly_alert', (data) => {
  console.log('Anomaly alert:', data);
});

// Keep connection open
process.stdin.resume();
```

---

## Performance Considerations

### Dashboard Ticker

- **Throttled** to 5-second intervals
- Only emits when data changes
- Targeted to controller room only
- Can be adjusted in `DashboardTicker` constructor

### Event Payloads

- Keep payloads minimal
- Only include necessary data
- Client fetches full details via REST API if needed

### Room Management

- Users automatically join rooms on connection
- No manual room management required
- Rooms cleaned up on disconnect

---

## Security

### Token Verification

- Every connection verified with Firebase Admin SDK
- Expired tokens rejected
- Invalid tokens rejected
- User role validated

### Room Isolation

- Examiners only receive events for their sheets
- Moderators receive all moderation events
- Controllers receive system-wide events
- No cross-room event leakage

### Data Privacy

- Student identity NEVER included in socket events
- Only anonymized sheet IDs transmitted
- Role-based access enforced at room level

---

## Migration from Legacy Events

### Deprecated Events (Do Not Use)

| Old Event | New Event | Notes |
|-----------|-----------|-------|
| `student_added` | `sheet_updated` | Use sheet-based events |
| `student_updated` | `sheet_updated` | Unified update event |
| `cheating_attempt` | `anomaly_alert` | Use anomaly system |
| `exam_paper_published` | N/A | Use REST API polling |
| `paper_received_ack` | N/A | Use REST API confirmation |

### Migration Steps

1. Replace `student_*` event handlers with `sheet_*` handlers
2. Replace `cheating_attempt` with `anomaly_alert`
3. Remove exam paper socket handlers (use REST API)
4. Add authentication to socket connection
5. Update event payload structure

---

**Last Updated:** September 2026  
**Version:** 1.0.0
