# Demo Credentials

Quick reference for testing the SAMADHAN X system.

## 🔑 Login Credentials

All demo accounts use the same password: **`Demo123!`**

### Examiners (5 users)

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| examiner1@demo.com | Demo123! | examiner | Mark assigned sheets (4 sheets each) |
| examiner2@demo.com | Demo123! | examiner | Mark assigned sheets |
| examiner3@demo.com | Demo123! | examiner | Mark assigned sheets |
| examiner4@demo.com | Demo123! | examiner | Mark assigned sheets |
| examiner5@demo.com | Demo123! | examiner | Mark assigned sheets |

**Permissions:**
- ✅ View assigned sheets (`GET /api/sheets/mine`)
- ✅ View sheet details (assigned only)
- ✅ Start marking assigned sheets
- ✅ Save marks for assigned sheets
- ✅ Submit assigned sheets
- ❌ Cannot view other examiners' sheets
- ❌ Cannot create exams
- ❌ Cannot upload sheets

### Moderator (1 user)

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| moderator@demo.com | Demo123! | moderator | Review and moderate all marked sheets |

**Permissions:**
- ✅ View ALL sheets (regardless of assignment)
- ✅ View sheet details (all sheets)
- ✅ Start marking any sheet
- ✅ Save marks for any sheet
- ✅ Submit any sheet
- ✅ Review and verify evaluated sheets
- ❌ Cannot create exams
- ❌ Cannot upload sheets

### Controller (1 user)

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| controller@demo.com | Demo123! | controller | Full system admin access |

**Permissions:**
- ✅ Create exams (`POST /api/exams`)
- ✅ Upload answer sheets (`POST /api/sheets/upload`)
- ✅ View all sheets with filters (`GET /api/sheets`)
- ✅ View sheet details (all sheets)
- ✅ Start marking any sheet
- ✅ Save marks for any sheet
- ✅ Submit any sheet
- ✅ Access identity mapping (Firestore direct)
- ✅ Full system control

---

## 📊 Demo Data Overview

### Exam
- **Title:** Computer Science Midterm Examination 2026
- **Questions:** 8 (100 marks total)
- **Languages:** English + Hindi

### Answer Sheets (20 total)
- **Uploaded:** 2 sheets (ready for assignment)
- **In Progress:** 13 sheets (currently being marked)
- **Evaluated:** 5 sheets (fully marked)

### Students
- **Roll Numbers:** CS2026001 to CS2026020
- **Names:** Fake/synthetic data only (Arjun Kumar, Priya Sharma, etc.)
- **Identity:** Protected (never exposed via API)

---

## 🧪 Testing Scenarios

### Test 1: Examiner Workflow

**Login as:** `examiner1@demo.com`

```bash
# Get your assigned sheets
GET /api/sheets/mine

# View a sheet (must be assigned to you)
GET /api/sheets/{sheet-id}

# Start marking
POST /api/sheets/{sheet-id}/start

# Save marks for question 1
PUT /api/sheets/{sheet-id}/marks/1
Body: {"marks": 8, "comment": "Good work"}

# Submit when done
POST /api/sheets/{sheet-id}/submit
```

**Expected:**
- ✅ See only your 4 assigned sheets
- ✅ Can mark and submit assigned sheets
- ❌ Cannot access sheets assigned to other examiners

### Test 2: Moderator Workflow

**Login as:** `moderator@demo.com`

```bash
# View all evaluated sheets
GET /api/sheets?status=evaluated

# Review any sheet (no assignment restriction)
GET /api/sheets/{any-sheet-id}

# Can modify marks if needed
PUT /api/sheets/{any-sheet-id}/marks/1
Body: {"marks": 9, "comment": "Revised score"}
```

**Expected:**
- ✅ See ALL sheets regardless of assignment
- ✅ Can review and modify any sheet
- ✅ No restrictions on sheet access

### Test 3: Controller Workflow

**Login as:** `controller@demo.com`

```bash
# Create a new exam
POST /api/exams
Body: {
  "title": "New Exam",
  "subject": "Physics",
  "questions": [...]
}

# Upload answer sheets
POST /api/sheets/upload
Form Data: rollNo, studentName, examId, pages (images)

# View all sheets
GET /api/sheets

# Filter by status
GET /api/sheets?status=uploaded
```

**Expected:**
- ✅ Full system access
- ✅ Can create exams and upload sheets
- ✅ Can view and manage all sheets

### Test 4: Access Control

**Login as:** `examiner1@demo.com`

```bash
# Try to access examiner2's sheet
GET /api/sheets/{examiner2-sheet-id}
```

**Expected:**
- ❌ 403 Forbidden
- Error: "You can only access sheets assigned to you"

```bash
# Try to create an exam
POST /api/exams
```

**Expected:**
- ❌ 403 Forbidden
- Error: "Access denied. Required role(s): controller"

### Test 5: Planted Test Cases

#### Unmarked Question (Sheet #11)

**Purpose:** Test UI behavior for incomplete marking

**Login as:** Examiner assigned to sheet #11

```bash
GET /api/sheets/{sheet-11-id}
```

**Expected:**
- ✅ See 7 marked questions
- ❌ Question 3 has no marks
- UI should highlight unmarked question

#### Unassigned Sheets (Sheets #1-2)

**Purpose:** Test assignment workflow

**Login as:** `controller@demo.com`

```bash
GET /api/sheets?status=uploaded
```

**Expected:**
- ✅ See 2 uploaded sheets
- Both have `assignedTo: null`
- Ready for assignment

---

## 🚀 Quick Start Guide

### Step 1: Run Seed Script

```bash
cd Website/backend
npm run seed
```

### Step 2: Start Server

```bash
npm start
```

Server runs on: `http://localhost:5000`

### Step 3: Get Firebase Token

From frontend or Firebase SDK:
```javascript
const token = await firebase.auth().currentUser.getIdToken();
```

### Step 4: Make API Request

```bash
curl http://localhost:5000/api/sheets/mine \
  -H "Authorization: Bearer <token>"
```

---

## 🔐 Security Notes

### Demo Environment Only

- ⚠️ Password `Demo123!` is for DEMO ONLY
- ⚠️ Do NOT use these credentials in production
- ⚠️ All student data is fake/synthetic

### Production Setup

For production deployment:
1. Use strong, unique passwords
2. Enable MFA/2FA where possible
3. Use real Firebase Auth flows (email verification, etc.)
4. Implement proper password policies
5. Regular security audits

---

## 📝 Role Permission Matrix

| Action | examiner | moderator | controller |
|--------|----------|-----------|------------|
| View assigned sheets | ✅ | N/A | N/A |
| View all sheets | ❌ | ✅ | ✅ |
| View any sheet details | ❌ (assigned only) | ✅ | ✅ |
| Start marking | ✅ (assigned only) | ✅ | ✅ |
| Save marks | ✅ (assigned only) | ✅ | ✅ |
| Submit sheet | ✅ (assigned only) | ✅ | ✅ |
| Create exam | ❌ | ❌ | ✅ |
| Upload sheets | ❌ | ❌ | ✅ |
| View exams | ✅ | ✅ | ✅ |
| Access identity map | ❌ | ❌ | ✅ (Firestore) |

---

## 🐛 Troubleshooting

### "Invalid credentials"
- Check email spelling (case-sensitive)
- Verify password is exactly: `Demo123!`
- Run seed script again: `npm run seed`

### "User not found"
- Run seed script: `npm run seed`
- Check Firebase console for user existence

### "Permission denied"
- Verify role in Firestore `users/{uid}` collection
- Check you're using correct account for the action
- Review permission matrix above

### "Sheet not found"
- Run seed script to recreate data
- Verify sheet ID is correct
- Check sheet exists in Firestore console

---

## 📞 Support

For demo/testing issues:
1. Run `npm run seed` to reset demo data
2. Check server logs for errors
3. Verify Firebase configuration
4. Review API documentation

---

**Last Updated:** September 2026  
**Environment:** Development/Demo Only
