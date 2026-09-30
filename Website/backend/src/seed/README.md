# Seed Data Documentation

## Overview

The seed script (`seed.js`) creates demo data for development and testing purposes. It populates Firebase Auth and Firestore with realistic sample data.

## What Gets Created

### 1. **Users** (7 total)

#### Examiners (5)
- `examiner1@demo.com` to `examiner5@demo.com`
- Password: `Demo123!`
- Role: `examiner`
- Can mark assigned sheets

#### Moderator (1)
- `moderator@demo.com`
- Password: `Demo123!`
- Role: `moderator`
- Can review all sheets

#### Controller (1)
- `controller@demo.com`
- Password: `Demo123!`
- Role: `controller`
- Full system access

### 2. **Exam** (1)

**Computer Science Midterm Examination 2026**

- **Subject:** Computer Science
- **Questions:** 8 total (6 in English, 2 in Hindi/bilingual)
- **Total Max Marks:** 100
- **Duration:** 180 minutes (3 hours)

#### Question Breakdown

| Q# | Marks | Language | Topic |
|----|-------|----------|-------|
| 1 | 10 | English | Object-Oriented Programming principles |
| 2 | 15 | English | Binary search implementation (Python) |
| 3 | 12 | Hindi/English | Database normalization (1NF, 2NF, 3NF) |
| 4 | 8 | English | OSI model layers |
| 5 | 10 | English | TCP vs UDP protocols |
| 6 | 15 | Hindi/English | Stack vs Queue data structures |
| 7 | 12 | English | SQL JOIN operations |
| 8 | 18 | English | Library management system DB design |

Each question includes:
- Question text
- Model answer
- Detailed rubric with criterion, points, and descriptions

### 3. **Answer Sheets** (20)

#### Fake Students (Synthetic Data)
- Roll Numbers: `CS2026001` to `CS2026020`
- Names: Synthetic Indian names (Arjun Kumar, Priya Sharma, etc.)
- **Note:** All student data is completely fake and for demo purposes only

#### Sheet Properties
- **Anonymized IDs:** Each sheet gets a unique ID like `SHEET-a1b2c3d4e5`
- **Pages:** 4-6 placeholder pages per sheet (SVG images)
- **Assignment:** Round-robin distribution across 5 examiners
- **Status Distribution:**
  - **Uploaded** (2 sheets): Not started, ready for assignment
  - **In Progress** (13 sheets): Currently being marked (70% questions marked)
  - **Evaluated** (5 sheets): Fully marked and submitted

#### Planted Test Cases

For testing specific scenarios:

1. **Sheet #11** - Has an unmarked question (Q3)
   - Purpose: Test UI behavior for incomplete marking
   - Status: `in_progress`
   - Missing: Question 3 marks

2. **Sheets #1-2** - Uploaded status
   - Purpose: Test assignment workflow
   - Status: `uploaded`
   - No examiner assigned yet

### 4. **Identity Map** (20 entries)

Separate collection that maps anonymized sheet IDs to student identity:
- `sheetId` → `rollNo` + `studentName`
- **Never exposed via API** (privacy protection)
- Only accessible via direct Firestore access by controllers

### 5. **Marks** (varies)

Individual question marks for sheets that are in progress or evaluated:
- Each mark entry includes: marks, comment, time spent, marked by, marked at
- Marks range from 70-100% of question max marks
- Variety of examiner comments for realism

---

## Running the Seed Script

### Prerequisites

1. **Firebase Admin SDK configured**
   ```bash
   # Set in .env
   FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccountKey.json
   ```

2. **Server dependencies installed**
   ```bash
   npm install
   ```

### Execute Seed

```bash
npm run seed
```

### What Happens

1. **Creates/updates users** in Firebase Auth and Firestore
2. **Wipes existing demo data** from collections:
   - `exams`
   - `sheets`
   - `identityMap`
   - `marks`
3. **Creates 1 exam** with 8 questions
4. **Creates 20 answer sheets** with marks and identity mapping
5. **Assigns sheets** to examiners

### Output Example

```
🌱 SAMADHAN X Demo Data Seeding

═══════════════════════════════════════════════════════════

👥 Creating demo users...
  ✓ Created user: examiner1@demo.com
  ✓ Created user: examiner2@demo.com
  ...

  📊 Summary:
     • Examiners: 5
     • Moderators: 1
     • Controllers: 1

  🔑 Demo Credentials:
     • Email: examiner1@demo.com (and 2-5)
     • Email: moderator@demo.com
     • Email: controller@demo.com
     • Password: Demo123! (all users)

🗑️  Wiping demo collections...
  ✓ exams: deleted 1 documents
  ✓ sheets: deleted 20 documents
  ✓ identityMap: deleted 20 documents
  ✓ marks: deleted 143 documents

📝 Creating demo exam...
  ✓ Created exam: Computer Science Midterm Examination 2026
  📊 Total Max Marks: 100
  📝 Questions: 8 (2 in Hindi)

📄 Creating demo answer sheets...
  ✓ Created sheet 1/20: SHEET-abc123 (uploaded)
  ✓ Created sheet 2/20: SHEET-def456 (uploaded)
  ...

  📍 Planted test cases:
     • Sheet #11: Has unmarked question (Q3)
     • Sheet #1-2: Uploaded status (not started)

═══════════════════════════════════════════════════════════
✅ Seeding completed successfully!

📊 Summary:
   • Users: 7
   • Exams: 1
   • Sheets: 20
   • Identity mappings: 20
   • Status distribution:
     - Uploaded: 2
     - In Progress: 13
     - Evaluated: 5

🚀 You can now:
   1. Start the server: npm start
   2. Login with demo credentials
   3. Test the API endpoints
```

---

## Testing After Seeding

### 1. Login as Examiner

```bash
# Get Firebase ID token from frontend or using Firebase SDK
# Then make requests with the token

curl http://localhost:5000/api/sheets/mine \
  -H "Authorization: Bearer <examiner-token>"
```

**Expected:** See assigned sheets only

### 2. Login as Controller

```bash
curl http://localhost:5000/api/sheets?status=uploaded \
  -H "Authorization: Bearer <controller-token>"
```

**Expected:** See all uploaded sheets

### 3. Test Sheet Details

```bash
curl http://localhost:5000/api/sheets/<sheet-id> \
  -H "Authorization: Bearer <examiner-token>"
```

**Expected:** See sheet pages, exam questions, and current marks (NO student identity)

### 4. Test Marking

```bash
curl -X PUT http://localhost:5000/api/sheets/<sheet-id>/marks/1 \
  -H "Authorization: Bearer <examiner-token>" \
  -H "Content-Type: application/json" \
  -d '{"marks": 8, "comment": "Good work", "timeSpentSec": 120}'
```

**Expected:** Mark saved, total recalculated

---

## Data Statistics

### Sheet Status Distribution
- **Uploaded:** 10% (2 sheets)
- **In Progress:** 65% (13 sheets)
- **Evaluated:** 25% (5 sheets)

### Marks Distribution
- **In Progress sheets:** ~70% of questions marked
- **Evaluated sheets:** 100% of questions marked
- **Mark range:** 70-100% of max marks per question

### Examiner Workload
Each examiner gets assigned 4 sheets (round-robin):
- Examiner 1: Sheets 1, 6, 11, 16
- Examiner 2: Sheets 2, 7, 12, 17
- Examiner 3: Sheets 3, 8, 13, 18
- Examiner 4: Sheets 4, 9, 14, 19
- Examiner 5: Sheets 5, 10, 15, 20

---

## Re-running the Seed

You can safely run `npm run seed` multiple times:

1. **User accounts** - Will be updated (not duplicated)
2. **Demo collections** - Will be completely wiped and recreated
3. **New anonymized IDs** - Generated each time (different sheet IDs)

**Warning:** This will **delete all existing data** in:
- exams
- sheets
- identityMap
- marks

---

## Extending the Seed

### Adding More Students

Edit `FAKE_STUDENTS` array in `seed.js`:

```javascript
const FAKE_STUDENTS = [
  { rollNo: 'CS2026021', name: 'New Student' },
  // ... add more
];
```

### Adding Historical Events

(Coming soon - placeholder for future extension)

```javascript
// Create historical marking events
// Create calibration sheets
// Add anomaly patterns
```

### Adding More Exams

```javascript
const exam2 = await createDemoExam(controllerUid);
// Then create sheets for exam2
```

---

## Privacy & Security Notes

### Student Identity Protection

1. **Identity Map** - Separate collection, never exposed via API
2. **Anonymized IDs** - All API responses use `SHEET-xxxxxx` format
3. **Fake Data Only** - All student names and roll numbers are synthetic
4. **No Real Data** - Never use real student information in seed data

### Demo Credentials Security

- **Password:** `Demo123!` (change in production!)
- **Demo Only:** These accounts are for development/testing
- **Production:** Use different credentials and secure password policies

---

## Troubleshooting

### "Firebase Admin not configured"

**Solution:** Set `FIREBASE_SERVICE_ACCOUNT` in `.env`

```bash
FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccountKey.json
```

### "Permission denied" errors

**Solution:** Check Firebase project permissions. Service account needs:
- `Firebase Authentication Admin`
- `Cloud Datastore User` (for Firestore)

### Seed hangs or times out

**Solution:** Check network connection to Firebase. Large batches may take time.

### Users already exist

**Solution:** This is normal. The script updates existing users rather than creating duplicates.

---

## Future Extensions (Planned)

- [ ] Historical marking events for analytics
- [ ] Calibration sheets with known correct marks
- [ ] Anomaly patterns for testing detection
- [ ] Multiple exams with different subjects
- [ ] Different marking difficulty levels
- [ ] Time-series data for trends

---

## Support

For issues with seeding:
1. Check Firebase console for actual data
2. Review server logs during seed execution
3. Verify `.env` configuration
4. Check network connectivity to Firebase

---

**Last Updated:** September 2026  
**Version:** 1.0.0
