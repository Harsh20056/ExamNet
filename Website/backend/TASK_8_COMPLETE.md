# Task 8: Analytics & Cross-Sheet Anomaly Detection - Complete ✅

## Overview

Task 8 adds comprehensive analytics for examiners and controllers, plus cross-sheet anomaly detection rules (P1, P2, P5) to identify patterns across multiple sheets.

---

## ✅ Implemented Features

### 1. Analytics Service & Routes

**Analytics Routes:**
- `GET /api/analytics/me` - Get current examiner's statistics with peer comparison
- `GET /api/analytics/examiners` - Get all examiners' statistics (controller only)
- `GET /api/analytics/progress` - Get marking progress and predictions (controller only)

**Per-Examiner Metrics:**
- Total sheets (assigned, completed, in progress)
- Average time per sheet (seconds and minutes)
- Sheets per day
- Average marks and percentage
- Deviation from peer mean
- Z-score (statistical significance)
- Override rate (% of AI suggestions overridden)
- Moderation change rate (% of sheets adjusted by moderators)
- Calibration score (quality metric: 1.0 = perfect)

**Peer Comparison:**
- Peer mean marks and standard deviation
- Peer percentage mean and standard deviation
- Peer count (number of other examiners)
- Percentage deviation from peers
- Z-score for statistical significance

**Progress Metrics:**
- Overall counts by status (uploaded, in_progress, evaluated, flagged, final)
- Counts by examiner
- Counts by subject
- Predicted completion time based on recent marking velocity

**Features:**
- ✅ All computed from stored data (no hard-coded numbers)
- ✅ Cached for 5 seconds to reduce load
- ✅ Handles edge cases (division by zero, insufficient data)
- ✅ Rounds numbers for clean output

---

### 2. Cross-Sheet Anomaly Detection

**New Anomaly Types:**

#### P1: Peer Deviation
**Purpose:** Detect examiner marking significantly higher than peers

**Algorithm:**
1. Get examiner's completed sheets for exam
2. Calculate examiner's average percentage
3. Get all other examiners' sheets for same exam
4. Calculate peer mean and standard deviation
5. Compute z-score: `(examiner_mean - peer_mean) / peer_stddev`
6. Flag if z-score > 2.0 (significantly higher)

**Minimum Sample Size:** 5 sheets (examiner and peers)

**Severity:** MEDIUM

**Example Alert:**
```
Examiner's average marks (78%) significantly higher than peers (65%)
z-score: 2.3, deviation: +13%
```

---

#### P2: Repeated Totals
**Purpose:** Detect same total appearing too frequently (suspicious pattern)

**Algorithm:**
1. Get examiner's completed sheets for exam
2. Count frequency of each total
3. Calculate percentage of sheets with current total
4. Flag if frequency > 30%

**Minimum Sample Size:** 10 sheets

**Severity:** MEDIUM

**Example Alert:**
```
Total marks 45 appears in 35% of sheets
Occurrences: 7 out of 20 sheets
```

---

#### P5: Speed Drift
**Purpose:** Detect significant change in marking speed (fatigue or rushing)

**Algorithm:**
1. Get examiner's last 20 completed sheets
2. Split into baseline (older half) and recent (newer half)
3. Calculate average time for each group
4. Compute percentage change
5. Flag if changed by > 50% (either faster or slower)

**Minimum Sample Size:** 10 sheets (5 baseline, 5 recent)

**Severity:** MEDIUM

**Example Alert:**
```
Marking speed changed significantly: 60% faster
Baseline average: 1200s, Recent average: 480s
```

---

### 3. Integration with Existing Systems

**Automatic Execution:**
- Cross-sheet anomalies checked on every sheet submission
- Runs after per-sheet anomalies (A1, A3, A4, A5)
- All alerts combined and stored together

**Guarded by Minimum Sample Sizes:**
- P1: Requires ≥5 sheets from examiner and ≥5 from peers
- P2: Requires ≥10 sheets from examiner
- P5: Requires ≥10 total sheets (split into baseline/recent)

**No False Positives on Early Sheets:**
- Rules don't trigger until sufficient data collected
- Prevents alerting on first few sheets

---

## 📂 Files Created/Updated

### New Files
1. **`src/services/analytics.js`** - Analytics computation service
   - `getExaminerStats()` - Individual examiner statistics
   - `getAllExaminersStats()` - All examiners with peer comparison
   - `getExaminerStatsWithPeerComparison()` - Examiner with peer context
   - `getProgressStats()` - Overall progress metrics
   - Utility functions: `average()`, `standardDeviation()`, `zScore()`

2. **`src/routes/analytics.js`** - Analytics API routes
   - GET /api/analytics/me
   - GET /api/analytics/examiners
   - GET /api/analytics/progress

3. **`TASK_8_COMPLETE.md`** - This documentation

### Updated Files
4. **`src/services/anomalyEngine.js`** - Added cross-sheet detection
   - `checkPeerDeviation()` - P1 implementation
   - `checkRepeatedTotals()` - P2 implementation
   - `checkSpeedDrift()` - P5 implementation
   - `checkCrossSheetAnomalies()` - Main cross-sheet check
   - `calculateStats()` - Statistical helper

5. **`src/config/anomalyThresholds.js`** - Added cross-sheet thresholds
   - MIN_SAMPLE_SIZE_PEER: 5
   - PEER_DEVIATION_Z_SCORE_THRESHOLD: 2.0
   - MIN_SAMPLE_SIZE_REPEATED: 10
   - REPEATED_TOTAL_FREQUENCY_THRESHOLD: 0.30
   - MIN_SAMPLE_SIZE_SPEED: 10
   - SPEED_DRIFT_PERCENTAGE_THRESHOLD: 50
   - Added P1, P2, P5 to ANOMALY_TYPES

6. **`src/services/sheetService.js`** - Integrated cross-sheet checks
   - `submitSheet()` now calls `checkCrossSheetAnomalies()`
   - Combines per-sheet and cross-sheet alerts

7. **`server.js`** - Mounted analytics routes

---

## 🔐 Security & Access Control

### Analytics Routes

| Route | examiner | moderator | controller |
|-------|----------|-----------|------------|
| GET /api/analytics/me | ✅ | ❌ | ❌ |
| GET /api/analytics/examiners | ❌ | ❌ | ✅ |
| GET /api/analytics/progress | ❌ | ❌ | ✅ |

**Rules:**
- Examiners can only see their own statistics
- Only controllers can see all examiners' statistics
- Only controllers can see overall progress

---

## 📊 API Examples

### Get My Statistics (Examiner)

**Request:**
```bash
curl http://localhost:5000/api/analytics/me \
  -H "Authorization: Bearer <examiner-token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uid": "examiner-uid",
    "name": "John Doe",
    "totalSheets": 25,
    "completedSheets": 20,
    "inProgressSheets": 5,
    "averageTimePerSheet": 1200,
    "averageTimePerSheetMinutes": 20.0,
    "sheetsPerDay": 4.5,
    "averageMarks": 18.5,
    "averagePercentage": 74.0,
    "deviationFromPeerMean": -2.3,
    "zScore": -0.5,
    "percentageDeviationFromPeerMean": -1.8,
    "percentageZScore": -0.4,
    "overrideRate": 25.0,
    "moderationChangeRate": 10.0,
    "calibrationScore": 0.892,
    "peerComparison": {
      "peerMean": 20.8,
      "peerStdDev": 4.2,
      "peerPercentageMean": 75.8,
      "peerPercentageStdDev": 5.1,
      "peerCount": 4
    }
  },
  "timestamp": "2026-09-30T..."
}
```

---

### Get All Examiners (Controller)

**Request:**
```bash
curl http://localhost:5000/api/analytics/examiners \
  -H "Authorization: Bearer <controller-token>"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "uid": "examiner1-uid",
      "name": "John Doe",
      "email": "examiner1@demo.com",
      "totalSheets": 25,
      "completedSheets": 20,
      "averageMarks": 18.5,
      "averagePercentage": 74.0,
      "deviationFromPeerMean": -2.3,
      "zScore": -0.5,
      "overrideRate": 25.0,
      "moderationChangeRate": 10.0,
      "calibrationScore": 0.892
    },
    {
      "uid": "examiner2-uid",
      "name": "Jane Smith",
      "email": "examiner2@demo.com",
      "totalSheets": 30,
      "completedSheets": 28,
      "averageMarks": 22.1,
      "averagePercentage": 78.5,
      "deviationFromPeerMean": 1.3,
      "zScore": 0.31,
      "overrideRate": 15.0,
      "moderationChangeRate": 5.0,
      "calibrationScore": 0.945
    }
  ],
  "timestamp": "2026-09-30T..."
}
```

---

### Get Progress (Controller)

**Request:**
```bash
curl http://localhost:5000/api/analytics/progress \
  -H "Authorization: Bearer <controller-token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "total": 100,
      "uploaded": 10,
      "inProgress": 15,
      "evaluated": 50,
      "flagged": 5,
      "final": 20
    },
    "byExaminer": [
      {
        "uid": "examiner1-uid",
        "name": "John Doe",
        "total": 25,
        "uploaded": 0,
        "inProgress": 5,
        "evaluated": 15,
        "flagged": 2,
        "final": 3
      }
    ],
    "bySubject": [
      {
        "subject": "Computer Science",
        "total": 50,
        "uploaded": 5,
        "inProgress": 8,
        "evaluated": 30,
        "flagged": 2,
        "final": 5
      },
      {
        "subject": "Mathematics",
        "total": 50,
        "uploaded": 5,
        "inProgress": 7,
        "evaluated": 20,
        "flagged": 3,
        "final": 15
      }
    ],
    "predictedCompletion": {
      "remainingSheets": 25,
      "recentSheetsPerHour": 2.5,
      "estimatedHoursRemaining": 10.0,
      "estimatedCompletionTime": "2026-10-01T08:30:00.000Z"
    }
  },
  "timestamp": "2026-09-30T..."
}
```

---

## 🔬 Cross-Sheet Anomaly Examples

### Example 1: P1 - Peer Deviation Alert

**Scenario:** Examiner marks consistently higher than peers

**Trigger:**
- Examiner's average: 78%
- Peer average: 65%
- Standard deviation: 5.6%
- Z-score: 2.32 (> 2.0 threshold)

**Alert Created:**
```json
{
  "type": "P1_PEER_DEVIATION",
  "severity": "medium",
  "message": "Examiner's average marks (78%) significantly higher than peers (65%)",
  "metadata": {
    "examinerMean": 78.0,
    "peerMean": 65.0,
    "deviation": 13.0,
    "zScore": 2.32,
    "examinerSampleSize": 15,
    "peerSampleSize": 45
  }
}
```

**Action:** Controller reviews examiner's marking for consistency

---

### Example 2: P2 - Repeated Totals Alert

**Scenario:** Same total appears too frequently

**Trigger:**
- Total: 45 marks
- Appears in 7 out of 20 sheets (35%)
- Threshold: 30%

**Alert Created:**
```json
{
  "type": "P2_REPEATED_TOTALS",
  "severity": "medium",
  "message": "Total marks 45 appears in 35% of sheets",
  "metadata": {
    "total": 45,
    "occurrences": 7,
    "totalSheets": 20,
    "frequency": 0.35,
    "frequencyPercentage": 35
  }
}
```

**Action:** Investigate if marks are being artificially rounded or if answer key is too predictable

---

### Example 3: P5 - Speed Drift Alert

**Scenario:** Examiner marking much faster than before

**Trigger:**
- Baseline average: 1200 seconds (20 minutes)
- Recent average: 480 seconds (8 minutes)
- Change: 60% faster
- Threshold: 50%

**Alert Created:**
```json
{
  "type": "P5_SPEED_DRIFT",
  "severity": "medium",
  "message": "Marking speed changed significantly: 60% faster",
  "metadata": {
    "baselineAverage": 1200,
    "recentAverage": 480,
    "percentageChange": -60.0,
    "direction": "faster",
    "baselineSampleSize": 5,
    "recentSampleSize": 5
  }
}
```

**Action:** Review if quality decreased due to rushing, or if examiner became more efficient

---

## 📈 Analytics Formulas

### Calibration Score
```
calibration_score = 1.0 - (moderation_change_rate / 100) * 0.5 - (override_rate / 100) * 0.3
```

**Interpretation:**
- 1.0 = Perfect (no moderator adjustments, accepts AI suggestions)
- 0.9-0.99 = Excellent
- 0.8-0.89 = Good
- 0.7-0.79 = Fair
- < 0.7 = Needs improvement

### Z-Score
```
z_score = (examiner_value - peer_mean) / peer_stddev
```

**Interpretation:**
- z > 2.0: Significantly above peers (potential over-marking)
- -2.0 < z < 2.0: Normal range
- z < -2.0: Significantly below peers (potential under-marking)

### Sheets Per Day
```
sheets_per_day = completed_sheets / days_elapsed
days_elapsed = (max_completed_date - min_completed_date) / (24 * 60 * 60 * 1000)
```

### Predicted Completion
```
sheets_per_hour = recent_completed_count / hours_elapsed_recent
hours_remaining = remaining_sheets / sheets_per_hour
estimated_completion = current_time + hours_remaining
```

---

## 🧪 Testing

### Test Analytics Routes

1. **Test examiner's own statistics:**
   ```bash
   curl http://localhost:5000/api/analytics/me \
     -H "Authorization: Bearer <examiner-token>"
   ```

2. **Test all examiners (controller):**
   ```bash
   curl http://localhost:5000/api/analytics/examiners \
     -H "Authorization: Bearer <controller-token>"
   ```

3. **Test progress:**
   ```bash
   curl http://localhost:5000/api/analytics/progress \
     -H "Authorization: Bearer <controller-token>"
   ```

---

### Test Cross-Sheet Anomalies

1. **Create scenario for P1 (peer deviation):**
   - Have one examiner mark significantly higher than others
   - Submit enough sheets (>5) to trigger check
   - Alert should appear in submission response

2. **Create scenario for P2 (repeated totals):**
   - Have examiner give same total (e.g., 45) to many sheets
   - Submit 10+ sheets with same total
   - Alert should trigger when frequency > 30%

3. **Create scenario for P5 (speed drift):**
   - Mark first 5 sheets slowly (20 minutes each)
   - Mark next 5 sheets quickly (5 minutes each)
   - Alert should trigger on 10th sheet for 75% speed increase

4. **Verify alerts are stored:**
   ```bash
   curl http://localhost:5000/api/alerts?type=P1_PEER_DEVIATION \
     -H "Authorization: Bearer <controller-token>"
   ```

---

## 💡 Use Cases

### Use Case 1: Identifying Lenient Marking

**Scenario:** Controller notices one examiner marks higher than peers

1. Controller views examiner analytics
2. Sees examiner's z-score: 2.5 (very high)
3. Sees P1 alerts on recent sheets
4. Reviews sample sheets to confirm over-marking
5. Provides feedback and calibration training

---

### Use Case 2: Detecting Marking Fatigue

**Scenario:** Examiner starts marking quickly but slows down significantly

1. P5 alert triggered: "50% slower"
2. Controller reviews examiner's workload
3. Discovers examiner has marked 40 sheets in 2 days
4. Redistributes remaining sheets to prevent burnout

---

### Use Case 3: Progress Monitoring

**Scenario:** Deadline approaching, controller needs completion estimate

1. Controller checks progress endpoint
2. Sees 25 sheets remaining
3. Sees recent rate: 2.5 sheets/hour
4. Predicted completion: 10 hours (next day morning)
5. Decides current pace is acceptable

---

### Use Case 4: Examiner Self-Monitoring

**Scenario:** Examiner wants to compare their performance to peers

1. Examiner checks /api/analytics/me
2. Sees their average: 74% vs peer mean: 76%
3. Sees calibration score: 0.89 (good)
4. Sees override rate: 25% (acceptable)
5. Confirms they're performing well

---

## 🎯 Benefits

### For Examiners
- ✅ Self-awareness of their marking patterns
- ✅ Comparison to peers (anonymized)
- ✅ Track improvement over time
- ✅ Identify if marking too fast/slow

### For Controllers
- ✅ Monitor all examiners at a glance
- ✅ Identify outliers needing attention
- ✅ Predict completion times accurately
- ✅ Data-driven workload distribution
- ✅ Early detection of quality issues

### For System Quality
- ✅ Prevent systematic over/under marking
- ✅ Detect suspicious patterns early
- ✅ Evidence-based calibration training
- ✅ Continuous quality monitoring

---

## ⚙️ Configuration

All thresholds are configurable in `src/config/anomalyThresholds.js`:

```javascript
// P1: Peer deviation
MIN_SAMPLE_SIZE_PEER: 5,
PEER_DEVIATION_Z_SCORE_THRESHOLD: 2.0,

// P2: Repeated totals
MIN_SAMPLE_SIZE_REPEATED: 10,
REPEATED_TOTAL_FREQUENCY_THRESHOLD: 0.30,

// P5: Speed drift
MIN_SAMPLE_SIZE_SPEED: 10,
SPEED_DRIFT_PERCENTAGE_THRESHOLD: 50,
```

**Tuning Recommendations:**
- Increase MIN_SAMPLE_SIZE for more reliable detection (but slower alerts)
- Decrease Z_SCORE_THRESHOLD for more sensitive peer deviation detection
- Decrease FREQUENCY_THRESHOLD to catch less frequent repetitions
- Adjust SPEED_DRIFT_PERCENTAGE for fatigue detection sensitivity

---

## ✅ Completion Checklist

- [x] Analytics service implemented
- [x] Analytics routes created (me, examiners, progress)
- [x] P1 peer deviation detection implemented
- [x] P2 repeated totals detection implemented
- [x] P5 speed drift detection implemented
- [x] Cross-sheet anomalies integrated into submit flow
- [x] Minimum sample sizes enforced
- [x] Thresholds configurable
- [x] Caching implemented (5 seconds)
- [x] All metrics computed from data (no hard-coded values)
- [x] Routes mounted in server.js
- [x] Access control enforced
- [x] Documentation complete

---

**Task 8 Status:** Complete ✅  
**Version:** 1.0.0  
**Last Updated:** 2026-09-30
