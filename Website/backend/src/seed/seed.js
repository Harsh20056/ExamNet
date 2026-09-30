#!/usr/bin/env node

/**
 * Seed Script for SAMADHAN X Demo Data
 * 
 * Creates:
 * - Demo users in Firebase Auth and Firestore (5 examiners, moderator, controller)
 * - 1 exam with 8 questions (English + Hindi)
 * - 4 calibration sheets with goldMarks
 * - 5 distinct Examiner profiles:
 *     E1: Normal (consistent, moderate timing ~120-180s/q, ~72% mean)
 *     E2: Generous (P1: mean marks > 92%, peer z-score > 2.0)
 *     E3: Rushed (A5: per-question time < 30s, P5: speed drift > 50% between baseline and recent)
 *     E4: Repeated totals (P2: identical total marks on > 30% of sheets)
 *     E5: Calibration drift (P4: marks differ from goldMarks by > 20%, score < 80%)
 * - Planted edge test cases:
 *     1. Over-maximum mark (A3): Q2 awarded 18/15
 *     2. Unmarked question (A1): Q3 unmarked on evaluated sheet
 *     3. Unviewed page: alert UNVIEWED_PAGE
 *     4. Large AI-vs-examiner gap: AI suggested 14, examiner gave 4
 * - A few hundred historical events (marks, timings, AI calls with decisions, moderation, audit trail)
 * 
 * Usage: npm run seed
 */

require('dotenv').config();
const { getAdmin } = require('../config/firebaseAdmin');
const { getFirestore, Collections, SheetStatus } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');
const { ANOMALY_TYPES, ANOMALY_THRESHOLDS, ALERT_STATUS } = require('../config/anomalyThresholds');
const { nanoid } = require('nanoid');

// Demo user credentials
const DEMO_USERS = [
  { email: 'examiner1@demo.com', password: 'Demo123!', role: 'examiner', name: 'Examiner One (Normal)' },
  { email: 'examiner2@demo.com', password: 'Demo123!', role: 'examiner', name: 'Examiner Two (Generous P1)' },
  { email: 'examiner3@demo.com', password: 'Demo123!', role: 'examiner', name: 'Examiner Three (Rushed A5/P5)' },
  { email: 'examiner4@demo.com', password: 'Demo123!', role: 'examiner', name: 'Examiner Four (Repeated P2)' },
  { email: 'examiner5@demo.com', password: 'Demo123!', role: 'examiner', name: 'Examiner Five (Drift P4)' },
  { email: 'moderator@demo.com', password: 'Demo123!', role: 'moderator', name: 'Demo Moderator' },
  { email: 'controller@demo.com', password: 'Demo123!', role: 'controller', name: 'Demo Controller' }
];

// Gold standard marks for calibration sheets (Total = 75 / 100)
const GOLD_MARKS = [
  { qNo: 1, marks: 8 },
  { qNo: 2, marks: 12 },
  { qNo: 3, marks: 9 },
  { qNo: 4, marks: 6 },
  { qNo: 5, marks: 8 },
  { qNo: 6, marks: 12 },
  { qNo: 7, marks: 9 },
  { qNo: 8, marks: 14 }
];

// Generate placeholder page image (SVG as base64)
function generatePlaceholderPage(pageNumber, rollNo) {
  const svg = `
    <svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="1000" fill="#f8fafc"/>
      <rect x="30" y="30" width="740" height="940" fill="white" stroke="#cbd5e1" stroke-width="2" rx="8"/>
      <text x="400" y="80" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#0f172a">
        SAMADHAN X - Secure Answer Sheet
      </text>
      <text x="400" y="115" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#64748b">
        Sheet Anonymized ID: ${rollNo} | Page ${pageNumber} of 5
      </text>
      <line x1="50" y1="135" x2="750" y2="135" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="70" y="180" font-family="monospace" font-size="14" fill="#334155">
        Q${pageNumber}. Handwritten response section:
      </text>
      <rect x="70" y="200" width="660" height="700" fill="#fcfcfc" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4"/>
      <text x="400" y="520" font-family="sans-serif" font-size="15" text-anchor="middle" fill="#94a3b8">
        [Student written answer text and schematic diagram content for Page ${pageNumber}]
      </text>
      <text x="400" y="930" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#94a3b8">
        Barcoded Security Verification Token &bull; MPOnline 2026 Examination System
      </text>
    </svg>
  `;
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// Create or update user in Firebase Auth and Firestore
async function createUser(userInfo) {
  const admin = getAdmin();
  const db = getFirestore();
  
  try {
    let user;
    try {
      user = await admin.auth().getUserByEmail(userInfo.email);
      console.log(`  ✓ User exists: ${userInfo.email}`);
    } catch (error) {
      user = await admin.auth().createUser({
        email: userInfo.email,
        password: userInfo.password,
        displayName: userInfo.name,
        emailVerified: true
      });
      console.log(`  ✓ Created user: ${userInfo.email}`);
    }
    
    await db.collection(Collections.USERS).doc(user.uid).set({
      email: userInfo.email,
      name: userInfo.name,
      role: userInfo.role,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    }, { merge: true });
    
    return user;
  } catch (error) {
    console.error(`  ✗ Failed to create user ${userInfo.email}:`, error.message);
    throw error;
  }
}

// Wipe demo collections
async function wipeCollections() {
  const db = getFirestore();
  console.log('\n🗑️  Wiping demo collections...');
  
  const collections = [
    Collections.EXAMS,
    Collections.SHEETS,
    Collections.IDENTITY_MAP,
    Collections.MARKS,
    'alerts',
    'aiCalls',
    'moderation',
    'audit'
  ];
  
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) {
      console.log(`  ✓ ${collectionName}: already empty`);
      continue;
    }
    
    // Batch delete in chunks of 400
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const chunk = docs.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    console.log(`  ✓ ${collectionName}: deleted ${snapshot.size} documents`);
  }
}

// Create demo exam
async function createDemoExam(controllerUid) {
  const db = getFirestore();
  console.log('\n📝 Creating demo exam...');
  
  const exam = {
    title: 'Computer Science Midterm Examination 2026',
    subject: 'Computer Science',
    examDate: '2026-10-15T09:00:00.000Z',
    duration: 180, // 3 hours
    instructions: 'Answer all questions. Write clearly and legibly. All questions carry indicated marks.',
    questions: [
      {
        qNo: 1,
        maxMarks: 10,
        text: 'Explain the concept of Object-Oriented Programming (OOP). Discuss its four main principles with examples.',
        modelAnswer: 'OOP is a paradigm organized around objects. Principles: 1) Encapsulation, 2) Abstraction, 3) Inheritance, 4) Polymorphism.',
        rubric: [
          { criterion: 'Definition of OOP', points: 2 },
          { criterion: 'Four principles identified', points: 4 },
          { criterion: 'Examples provided', points: 3 },
          { criterion: 'Clarity and structure', points: 1 }
        ]
      },
      {
        qNo: 2,
        maxMarks: 15,
        text: 'Implement a function in Python to perform binary search on a sorted array. Explain the time complexity.',
        modelAnswer: 'Binary search divides the search space in half each iteration giving O(log n) time complexity.',
        rubric: [
          { criterion: 'Correct implementation', points: 8 },
          { criterion: 'Time complexity explanation', points: 4 },
          { criterion: 'Code quality', points: 3 }
        ]
      },
      {
        qNo: 3,
        maxMarks: 12,
        text: 'डेटाबेस नॉर्मलाइज़ेशन क्या है? प्रथम, द्वितीय और तृतीय सामान्य रूप (1NF, 2NF, 3NF) की व्याख्या करें।\n(What is database normalization? Explain 1NF, 2NF, 3NF.)',
        modelAnswer: 'Normalization organizes tables to reduce redundancy. 1NF: Atomic values. 2NF: 1NF + no partial dependency. 3NF: 2NF + no transitive dependency.',
        rubric: [
          { criterion: 'Definition of normalization', points: 3 },
          { criterion: '1NF explained', points: 3 },
          { criterion: '2NF explained', points: 3 },
          { criterion: '3NF explained', points: 3 }
        ]
      },
      {
        qNo: 4,
        maxMarks: 8,
        text: 'Describe the OSI model layers. What is the function of each layer?',
        modelAnswer: '7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.',
        rubric: [
          { criterion: 'All 7 layers identified', points: 3 },
          { criterion: 'Functions explained', points: 4 },
          { criterion: 'Clarity', points: 1 }
        ]
      },
      {
        qNo: 5,
        maxMarks: 10,
        text: 'What are the differences between TCP and UDP protocols? When would you use each?',
        modelAnswer: 'TCP is connection-oriented and reliable. UDP is connectionless and faster.',
        rubric: [
          { criterion: 'TCP characteristics', points: 3 },
          { criterion: 'UDP characteristics', points: 3 },
          { criterion: 'Use cases', points: 3 },
          { criterion: 'Comparison clarity', points: 1 }
        ]
      },
      {
        qNo: 6,
        maxMarks: 15,
        text: 'स्टैक और क्यू डेटा संरचनाओं के बीच अंतर बताइए। प्रत्येक के लिए वास्तविक जीवन के उदाहरण दीजिए।\n(Explain difference between Stack and Queue with real life examples.)',
        modelAnswer: 'Stack is LIFO, Queue is FIFO. Stack: undo feature. Queue: printer spool.',
        rubric: [
          { criterion: 'Stack explanation', points: 4 },
          { criterion: 'Queue explanation', points: 4 },
          { criterion: 'Real-life examples', points: 5 },
          { criterion: 'Language proficiency', points: 2 }
        ]
      },
      {
        qNo: 7,
        maxMarks: 12,
        text: 'Explain SQL JOIN operations with examples. What are INNER JOIN, LEFT JOIN, and RIGHT JOIN?',
        modelAnswer: 'INNER JOIN matches both tables. LEFT JOIN takes all from left. RIGHT JOIN takes all from right.',
        rubric: [
          { criterion: 'JOIN concept explained', points: 3 },
          { criterion: 'INNER JOIN', points: 3 },
          { criterion: 'LEFT JOIN', points: 3 },
          { criterion: 'RIGHT JOIN', points: 3 }
        ]
      },
      {
        qNo: 8,
        maxMarks: 18,
        text: 'Design a simple library management system database schema with CREATE TABLE statements and constraints.',
        modelAnswer: 'Tables: books, members, transactions with primary and foreign key constraints.',
        rubric: [
          { criterion: 'Books table design', points: 4 },
          { criterion: 'Members table design', points: 4 },
          { criterion: 'Transactions table design', points: 5 },
          { criterion: 'SQL syntax correctness', points: 3 },
          { criterion: 'Normalization', points: 2 }
        ]
      }
    ],
    createdBy: controllerUid,
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  };
  
  const docRef = await db.collection(Collections.EXAMS).add(exam);
  console.log(`  ✓ Created exam: ${exam.title} (ID: ${docRef.id})`);
  return { id: docRef.id, ...exam };
}

/**
 * Seed historical audit log entry
 */
let auditSeq = 1;
let prevAuditHash = 'GENESIS_HASH';
async function createAuditEntry(db, { actor, role, action, sheetId, before, after, metadata, ts }) {
  const crypto = require('crypto');
  const entry = {
    seq: auditSeq++,
    ts: ts || getCurrentTimestamp(),
    actor,
    role,
    action,
    sheetId: sheetId || null,
    before: before || null,
    after: after || null,
    metadata: metadata || null,
    prevHash: prevAuditHash
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  entry.hash = hash;
  prevAuditHash = hash;
  await db.collection('audit').add(entry);
}

// Main seed function
async function seed() {
  console.log('🌱 SAMADHAN X Comprehensive Demo Data Seeding\n');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    const db = getFirestore();
    
    // Step 1: Create users
    console.log('\n👥 Creating demo users...');
    const userMap = {};
    const examinerList = [];
    let moderatorUid = null;
    let controllerUid = null;
    
    for (const userInfo of DEMO_USERS) {
      const user = await createUser(userInfo);
      userMap[userInfo.email] = user.uid;
      
      if (userInfo.role === 'examiner') {
        examinerList.push({ uid: user.uid, email: userInfo.email, name: userInfo.name });
      } else if (userInfo.role === 'moderator') {
        moderatorUid = user.uid;
      } else if (userInfo.role === 'controller') {
        controllerUid = user.uid;
      }
    }
    
    const [E1, E2, E3, E4, E5] = examinerList.map(e => e.uid);
    
    // Step 2: Wipe existing data
    await wipeCollections();
    
    // Step 3: Create exam
    const exam = await createDemoExam(controllerUid);
    const totalMaxMarks = exam.questions.reduce((sum, q) => sum + q.maxMarks, 0); // 100
    
    // Audit log: Exam creation
    await createAuditEntry(db, {
      actor: controllerUid,
      role: 'controller',
      action: 'exam_create',
      metadata: { examId: exam.id, title: exam.title }
    });
    
    console.log('\n📄 Creating sheets and historical evaluation records...');
    
    /**
     * Plan sheet generation:
     * - Calibration Sheets (C1, C2, C3, C4):
     *     C1 assigned to E1 (evaluated, matching gold marks perfectly)
     *     C2 assigned to E5 (evaluated, drifting heavily -> triggers P4 alert)
     *     C3 assigned to E2 (evaluated, generous)
     *     C4 unassigned/uploaded for live testing
     * - E1 (Normal): 10 sheets (evaluated, total marks ~70-76, time 120-180s per q)
     * - E2 (Generous P1): 10 sheets (evaluated, total marks 92-98%, time ~100s per q) -> P1 Peer Deviation
     * - E3 (Rushed A5 & P5): 12 sheets:
     *     First 6 baseline sheets (slower, ~150s per q, completed 5-7 days ago)
     *     Last 6 recent sheets (very fast, 15-25s per q, completed 1 day ago) -> P5 Speed Drift + A5 Time Anomaly
     * - E4 (Repeated P2): 11 sheets:
     *     4 sheets with exact total 68 -> 4/11 = 36% (>30% threshold) -> P2 Repeated Totals
     *     Remaining sheets with realistic scores
     * - Planted Anomalies:
     *     1. A3 (Marks exceed max): On E1's 3rd sheet, Q2 given 18 marks (max 15) -> A3 alert
     *     2. A1 (Unmarked question): On E1's 4th sheet, Q3 left unmarked -> A1 alert
     *     3. Unviewed page: On E3's sheet, alert UNVIEWED_PAGE planted
     *     4. Large AI-vs-examiner gap: On E1's 5th sheet, AI suggests 14, examiner gave 4 with 'overridden' decision
     */

    let sheetCounter = 1;
    const allSheets = [];
    
    // Helper to generate pages
    function makePages(sheetId) {
      return [1, 2, 3, 4, 5].map(p => ({
        pageNumber: p,
        fileName: `${sheetId}_p${p}.svg`,
        mimeType: 'image/svg+xml',
        size: 2048,
        dataUrl: generatePlaceholderPage(p, sheetId)
      }));
    }

    // Helper to generate and save marks for a sheet
    async function evaluateSheet({
      sheetId,
      examinerUid,
      questionMarks, // array of { qNo, marks, timeSpentSec, comment }
      startedAt,
      completedAt,
      status = SheetStatus.EVALUATED,
      isCalibration = false,
      goldMarks = null,
      notes = ''
    }) {
      const anonymizedId = `SHEET-${String(sheetCounter).padStart(3, '0')}-${nanoid(6)}`;
      sheetCounter++;
      
      const pages = makePages(anonymizedId);
      let calculatedTotal = 0;
      
      // Save identity mapping
      await db.collection(Collections.IDENTITY_MAP).add({
        sheetId: anonymizedId,
        rollNo: `ROLL2026${String(sheetCounter).padStart(3, '0')}`,
        studentName: `Candidate ${sheetCounter}`,
        createdAt: startedAt || getCurrentTimestamp()
      });

      const sheetDoc = {
        sheetId: anonymizedId,
        examId: exam.id,
        pages,
        status,
        assignedTo: examinerUid,
        uploadedBy: controllerUid,
        uploadedAt: new Date(new Date(startedAt).getTime() - 24 * 60 * 60 * 1000).toISOString(),
        startedAt,
        completedAt,
        totalMarks: 0,
        maxMarks: totalMaxMarks,
        isCalibration: !!isCalibration,
        goldMarks: isCalibration ? (goldMarks || GOLD_MARKS) : null,
        updatedAt: completedAt || startedAt
      };

      const sheetRef = await db.collection(Collections.SHEETS).add(sheetDoc);
      const sheetDatabaseId = sheetRef.id;
      sheetDoc.id = sheetDatabaseId;

      // Save marks
      for (const qMark of questionMarks) {
        calculatedTotal += qMark.marks;
        const markDocId = `${sheetDatabaseId}_q${qMark.qNo}`;
        await db.collection(Collections.MARKS).doc(markDocId).set({
          sheetId: sheetDatabaseId,
          qNo: qMark.qNo,
          marks: qMark.marks,
          comment: qMark.comment || 'Evaluated per rubric criterion',
          timeSpentSec: qMark.timeSpentSec || 120,
          markedBy: examinerUid,
          markedAt: completedAt || startedAt
        });

        // Audit log for mark save
        await createAuditEntry(db, {
          actor: examinerUid,
          role: 'examiner',
          action: 'mark_save',
          sheetId: sheetDatabaseId,
          after: { qNo: qMark.qNo, marks: qMark.marks, timeSpentSec: qMark.timeSpentSec },
          ts: completedAt || startedAt
        });
      }

      await sheetRef.update({ totalMarks: calculatedTotal });
      sheetDoc.totalMarks = calculatedTotal;

      // Audit log for sheet completion
      if (status === SheetStatus.EVALUATED || status === SheetStatus.FLAGGED) {
        await createAuditEntry(db, {
          actor: examinerUid,
          role: 'examiner',
          action: 'submit',
          sheetId: sheetDatabaseId,
          after: { totalMarks: calculatedTotal, status },
          ts: completedAt
        });
      }

      allSheets.push(sheetDoc);
      return sheetDoc;
    }

    // ─────────────────────────────────────────────────────────────
    // 1. CALIBRATION SHEETS (4 sheets)
    // ─────────────────────────────────────────────────────────────
    console.log('  📌 Seeding 4 Calibration Sheets...');

    // Calibration 1: E1 evaluates normally, aligns with Gold Marks (Score = 100%)
    const c1Date = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    await evaluateSheet({
      examinerUid: E1,
      startedAt: c1Date,
      completedAt: new Date(Date.now() - (6 * 24 - 1) * 60 * 60 * 1000).toISOString(),
      isCalibration: true,
      goldMarks: GOLD_MARKS,
      questionMarks: GOLD_MARKS.map(gm => ({
        qNo: gm.qNo,
        marks: gm.marks,
        timeSpentSec: 130,
        comment: 'Matches calibration criteria accurately'
      }))
    });

    // Calibration 2: E5 evaluates with severe calibration drift (P4)
    // Gives wildly different marks (difference > 20% on multiple questions)
    const c2Start = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const c2End = new Date(Date.now() - (5 * 24 - 1) * 60 * 60 * 1000).toISOString();
    const e5CalMarks = [
      { qNo: 1, marks: 3, timeSpentSec: 90, comment: 'Divergent evaluation' },   // Gold: 8
      { qNo: 2, marks: 6, timeSpentSec: 110, comment: 'Overly harsh' },         // Gold: 12
      { qNo: 3, marks: 3, timeSpentSec: 80, comment: 'Heavy deduction' },        // Gold: 9
      { qNo: 4, marks: 2, timeSpentSec: 70, comment: 'Inconsistent score' },     // Gold: 6
      { qNo: 5, marks: 4, timeSpentSec: 85, comment: 'Far from standard' },      // Gold: 8
      { qNo: 6, marks: 5, timeSpentSec: 90, comment: 'Drifted' },               // Gold: 12
      { qNo: 7, marks: 4, timeSpentSec: 80, comment: 'Far from standard' },      // Gold: 9
      { qNo: 8, marks: 6, timeSpentSec: 95, comment: 'Severe drift' }            // Gold: 14
    ];
    const c2Sheet = await evaluateSheet({
      examinerUid: E5,
      startedAt: c2Start,
      completedAt: c2End,
      isCalibration: true,
      status: SheetStatus.FLAGGED,
      goldMarks: GOLD_MARKS,
      questionMarks: e5CalMarks
    });

    // Plant P4 alert for E5's calibration drift
    await db.collection('alerts').add({
      sheetId: c2Sheet.id,
      type: ANOMALY_TYPES.P4_CALIBRATION_DRIFT,
      severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
      message: 'Calibration drift detected: 0.0% match with gold standard (0/8 questions)',
      metadata: {
        calibrationScore: 0,
        correctQuestions: 0,
        totalQuestions: 8,
        threshold: 80,
        examinerId: E5
      },
      status: ALERT_STATUS.PENDING,
      detectedBy: 'system',
      detectedAt: c2End,
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null
    });

    // Calibration 3: E2 generous evaluation
    const c3Date = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    await evaluateSheet({
      examinerUid: E2,
      startedAt: c3Date,
      completedAt: new Date(Date.now() - (4 * 24 - 1) * 60 * 60 * 1000).toISOString(),
      isCalibration: true,
      goldMarks: GOLD_MARKS,
      questionMarks: GOLD_MARKS.map(gm => ({
        qNo: gm.qNo,
        marks: Math.min(exam.questions.find(q => q.qNo === gm.qNo).maxMarks, gm.marks + 2),
        timeSpentSec: 100,
        comment: 'Generous credit awarded'
      }))
    });

    // Calibration 4: Freshly uploaded calibration sheet (unassigned, for testing assign endpoint)
    const c4Anonymized = `SHEET-${String(sheetCounter).padStart(3, '0')}-${nanoid(6)}`;
    sheetCounter++;
    await db.collection(Collections.SHEETS).add({
      sheetId: c4Anonymized,
      examId: exam.id,
      pages: makePages(c4Anonymized),
      status: SheetStatus.UPLOADED,
      assignedTo: null,
      uploadedBy: controllerUid,
      uploadedAt: getCurrentTimestamp(),
      startedAt: null,
      completedAt: null,
      totalMarks: 0,
      maxMarks: totalMaxMarks,
      isCalibration: true,
      goldMarks: GOLD_MARKS,
      updatedAt: getCurrentTimestamp()
    });

    // ─────────────────────────────────────────────────────────────
    // 2. EXAMINER 1 (Normal: ~72% mean, ~120-180s per question)
    // ─────────────────────────────────────────────────────────────
    console.log('  👤 Seeding Examiner 1 (Normal Profile + Planted Test Cases)...');
    for (let s = 1; s <= 8; s++) {
      const daysAgo = 8 - s;
      const started = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const completed = new Date(new Date(started).getTime() + 45 * 60 * 1000).toISOString();

      let qMarks = [
        { qNo: 1, marks: 7, timeSpentSec: 130, comment: 'Clear explanation' },
        { qNo: 2, marks: 11, timeSpentSec: 160, comment: 'Correct logic and complexity' },
        { qNo: 3, marks: 8, timeSpentSec: 140, comment: 'Good 1NF and 2NF details' },
        { qNo: 4, marks: 6, timeSpentSec: 90, comment: 'Layers correctly identified' },
        { qNo: 5, marks: 7, timeSpentSec: 120, comment: 'Valid differences noted' },
        { qNo: 6, marks: 11, timeSpentSec: 150, comment: 'Real life examples accurate' },
        { qNo: 7, marks: 9, timeSpentSec: 130, comment: 'Good JOIN illustrations' },
        { qNo: 8, marks: 13, timeSpentSec: 170, comment: 'Solid schema design' }
      ];

      // Plant Case 1: Over-maximum mark (A3) on sheet 2
      let hasA3 = false;
      if (s === 2) {
        hasA3 = true;
        qMarks = qMarks.map(qm => qm.qNo === 2 ? { ...qm, marks: 18 } : qm); // Max is 15!
      }

      // Plant Case 2: Unmarked question (A1) on sheet 3
      let hasA1 = false;
      if (s === 3) {
        hasA1 = true;
        qMarks = qMarks.filter(qm => qm.qNo !== 3); // Q3 left completely unmarked
      }

      const status = (hasA3 || hasA1) ? SheetStatus.FLAGGED : SheetStatus.EVALUATED;

      const createdSheet = await evaluateSheet({
        examinerUid: E1,
        startedAt: started,
        completedAt: completed,
        status,
        questionMarks: qMarks
      });

      if (hasA3) {
        await db.collection('alerts').add({
          sheetId: createdSheet.id,
          type: ANOMALY_TYPES.A3_MARKS_EXCEED_MAX,
          severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
          message: 'Marks for Q2 (18) exceed maximum (15)',
          metadata: { questionNo: 2, marksGiven: 18, maxMarks: 15, difference: 3 },
          status: ALERT_STATUS.PENDING,
          detectedBy: E1,
          detectedAt: completed,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null
        });
      }

      if (hasA1) {
        await db.collection('alerts').add({
          sheetId: createdSheet.id,
          type: ANOMALY_TYPES.A1_UNMARKED_QUESTION,
          severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
          message: 'Question 3 is unmarked',
          metadata: { questionNo: 3, maxMarks: 12 },
          status: ALERT_STATUS.PENDING,
          detectedBy: 'system',
          detectedAt: completed,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null
        });
      }

      // Plant Case 4: Large AI-vs-Examiner Gap on sheet 4, Question 2
      // AI suggested 14, Examiner gave 4 (Gap = 10 marks) with overridden decision
      if (s === 4) {
        await db.collection('aiCalls').add({
          sheetId: createdSheet.id,
          qNo: 2,
          questionText: exam.questions[1].text,
          maxMarks: 15,
          imageHash: 'cached',
          prompt: 'Binary search implementation evaluation',
          response: {
            suggestedMarks: 14,
            matched: ['Correct implementation', 'Time complexity explanation'],
            missed: [],
            transcription: 'def binary_search(arr, target): ...',
            confidence: 0.94,
            reason: 'Clean binary search implementation'
          },
          decision: {
            type: 'overridden',
            overrideMarks: 4,
            note: 'Student code has major off-by-one infinite loop bug not caught by AI; heavily penalized.'
          },
          status: 'success',
          source: 'cached_file',
          requestedBy: E1,
          processingTimeMs: 12,
          createdAt: completed
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. EXAMINER 2 (Generous: P1 Peer Deviation, ~92-96% marks)
    // ─────────────────────────────────────────────────────────────
    console.log('  👤 Seeding Examiner 2 (Generous Profile - Triggers P1 Peer Deviation)...');
    for (let s = 1; s <= 8; s++) {
      const daysAgo = 8 - s;
      const started = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const completed = new Date(new Date(started).getTime() + 30 * 60 * 1000).toISOString();

      // Generous marks: awarding 90-100% of maximum on almost every question
      const qMarks = [
        { qNo: 1, marks: 10, timeSpentSec: 110, comment: 'Flawless answer' },
        { qNo: 2, marks: 15, timeSpentSec: 120, comment: 'Outstanding code' },
        { qNo: 3, marks: 11, timeSpentSec: 100, comment: 'Very well explained' },
        { qNo: 4, marks: 8, timeSpentSec: 80, comment: 'Full marks' },
        { qNo: 5, marks: 9, timeSpentSec: 90, comment: 'Great comparison' },
        { qNo: 6, marks: 14, timeSpentSec: 110, comment: 'Excellent' },
        { qNo: 7, marks: 12, timeSpentSec: 105, comment: 'Complete JOIN explanation' },
        { qNo: 8, marks: 17, timeSpentSec: 130, comment: 'Superb schema' }
      ]; // Total = 96 / 100 (96%)

      const sheet = await evaluateSheet({
        examinerUid: E2,
        startedAt: started,
        completedAt: completed,
        questionMarks: qMarks
      });

      // On final sheet, register P1 peer deviation alert
      if (s === 8) {
        await db.collection('alerts').add({
          sheetId: sheet.id,
          type: ANOMALY_TYPES.P1_PEER_DEVIATION,
          severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
          message: "Examiner's average marks (95%) significantly higher than peers (72%)",
          metadata: {
            examinerMean: 95.2,
            peerMean: 71.8,
            deviation: 23.4,
            zScore: 2.85,
            examinerSampleSize: 8,
            peerSampleSize: 24
          },
          status: ALERT_STATUS.PENDING,
          detectedBy: 'system',
          detectedAt: completed,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. EXAMINER 3 (Rushed: A5 Time Anomaly & P5 Speed Drift)
    // ─────────────────────────────────────────────────────────────
    console.log('  👤 Seeding Examiner 3 (Rushed Profile - Triggers A5 & P5 Speed Drift)...');
    // First 6 baseline sheets (slower speed ~140s per question, completed 5-8 days ago)
    for (let s = 1; s <= 6; s++) {
      const daysAgo = 8 - s;
      const started = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const completed = new Date(new Date(started).getTime() + 35 * 60 * 1000).toISOString();

      const qMarks = exam.questions.map(q => ({
        qNo: q.qNo,
        marks: Math.round(q.maxMarks * 0.72),
        timeSpentSec: 130 + Math.floor(Math.random() * 30),
        comment: 'Baseline evaluation pacing'
      }));

      await evaluateSheet({
        examinerUid: E3,
        startedAt: started,
        completedAt: completed,
        questionMarks: qMarks
      });
    }

    // Next 6 sheets: Rushed speed (15-22 seconds per question -> triggers A5 and P5!)
    for (let s = 7; s <= 12; s++) {
      const hoursAgo = 14 - (s - 7) * 2;
      const started = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      const completed = new Date(new Date(started).getTime() + 3 * 60 * 1000).toISOString(); // Only 3 mins for whole sheet!

      const qMarks = exam.questions.map(q => ({
        qNo: q.qNo,
        marks: Math.round(q.maxMarks * 0.70),
        timeSpentSec: 18 + (q.qNo % 5), // 18 - 22 seconds per question (< 30s threshold!)
        comment: 'Quick assessment'
      }));

      const sheet = await evaluateSheet({
        examinerUid: E3,
        startedAt: started,
        completedAt: completed,
        status: s === 12 ? SheetStatus.FLAGGED : SheetStatus.EVALUATED,
        questionMarks: qMarks
      });

      // Plant A5 Time Anomaly alert
      if (s === 10) {
        await db.collection('alerts').add({
          sheetId: sheet.id,
          type: ANOMALY_TYPES.A5_TIME_ANOMALY,
          severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
          message: 'Evaluation completed too quickly: Q1 marked in 18s (median: 140s)',
          metadata: { questionNo: 1, timeSpentSec: 18, medianTimeSec: 140 },
          status: ALERT_STATUS.PENDING,
          detectedBy: 'system',
          detectedAt: completed,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null
        });
      }

      // Plant Case 3: Unviewed Page alert on sheet 11
      if (s === 11) {
        await db.collection('alerts').add({
          sheetId: sheet.id,
          type: ANOMALY_TYPES.UNVIEWED_PAGE,
          severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
          message: 'Sheet submitted without viewing Page 4',
          metadata: { sheetId: sheet.sheetId, unviewedPage: 4, totalPages: 5 },
          status: ALERT_STATUS.PENDING,
          detectedBy: 'system',
          detectedAt: completed,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null
        });
      }

      // Plant P5 Speed Drift alert on final sheet
      if (s === 12) {
        await db.collection('alerts').add({
          sheetId: sheet.id,
          type: ANOMALY_TYPES.P5_SPEED_DRIFT,
          severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
          message: 'Marking speed changed significantly: 82% faster than baseline',
          metadata: {
            baselineAverage: 1100, // seconds
            recentAverage: 180,    // seconds
            percentageChange: -83.6,
            direction: 'faster',
            baselineSampleSize: 6,
            recentSampleSize: 6
          },
          status: ALERT_STATUS.PENDING,
          detectedBy: 'system',
          detectedAt: completed,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. EXAMINER 4 (Repeated Totals: P2 > 30% sheets with identical total)
    // ─────────────────────────────────────────────────────────────
    console.log('  👤 Seeding Examiner 4 (Repeated Totals Profile - Triggers P2)...');
    // Seed 11 sheets where 4 sheets have the exact same total of 68 marks (4/11 = 36.4%)
    for (let s = 1; s <= 11; s++) {
      const daysAgo = 9 - (s * 0.7);
      const started = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const completed = new Date(new Date(started).getTime() + 25 * 60 * 1000).toISOString();

      let qMarks;
      if (s === 1 || s === 4 || s === 7 || s === 10) {
        // Repeated identical total of 68 marks
        qMarks = [
          { qNo: 1, marks: 7, timeSpentSec: 110 },
          { qNo: 2, marks: 10, timeSpentSec: 140 },
          { qNo: 3, marks: 8, timeSpentSec: 130 },
          { qNo: 4, marks: 5, timeSpentSec: 90 },
          { qNo: 5, marks: 7, timeSpentSec: 110 },
          { qNo: 6, marks: 10, timeSpentSec: 130 },
          { qNo: 7, marks: 8, timeSpentSec: 120 },
          { qNo: 8, marks: 13, timeSpentSec: 150 }
        ]; // Total = 68
      } else {
        qMarks = exam.questions.map(q => ({
          qNo: q.qNo,
          marks: Math.max(1, Math.round(q.maxMarks * (0.60 + (s * 0.02)))),
          timeSpentSec: 120,
          comment: 'Standard evaluation'
        }));
      }

      const sheet = await evaluateSheet({
        examinerUid: E4,
        startedAt: started,
        completedAt: completed,
        questionMarks: qMarks
      });

      if (s === 11) {
        await db.collection('alerts').add({
          sheetId: sheet.id,
          type: ANOMALY_TYPES.P2_REPEATED_TOTALS,
          severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
          message: 'Total marks 68 appears in 36% of sheets',
          metadata: {
            total: 68,
            occurrences: 4,
            totalSheets: 11,
            frequency: 0.36,
            frequencyPercentage: 36
          },
          status: ALERT_STATUS.PENDING,
          detectedBy: 'system',
          detectedAt: completed,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. EXAMINER 5 (Calibration Drift Profile: evaluated sheets)
    // ─────────────────────────────────────────────────────────────
    console.log('  👤 Seeding Examiner 5 (Calibration Drift Profile)...');
    for (let s = 1; s <= 6; s++) {
      const daysAgo = 7 - s;
      const started = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const completed = new Date(new Date(started).getTime() + 30 * 60 * 1000).toISOString();

      const qMarks = exam.questions.map(q => ({
        qNo: q.qNo,
        marks: Math.round(q.maxMarks * 0.55), // Drifts much lower than cohort
        timeSpentSec: 115,
        comment: 'Strict subjective scoring'
      }));

      await evaluateSheet({
        examinerUid: E5,
        startedAt: started,
        completedAt: completed,
        questionMarks: qMarks
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 7. HISTORICAL AI CALLS & MODERATION RECORDS (For rich charts)
    // ─────────────────────────────────────────────────────────────
    console.log('  🤖 Seeding historical AI evaluation calls & decisions...');
    const examiners = [E1, E2, E3, E4, E5];
    const aiCachedData = require('./cachedAIResults.json');

    // Create 40 historical AI calls across sheets and questions
    for (let i = 0; i < 40; i++) {
      const sheet = allSheets[i % allSheets.length];
      const qNo = (i % 8) + 1;
      const examiner = examiners[i % examiners.length];
      const qObj = exam.questions[qNo - 1];
      const cached = aiCachedData[`default_q${qNo}`];

      const isOverridden = (i % 5 === 0);
      const decisionType = isOverridden ? 'overridden' : 'accepted';
      const overrideMarks = isOverridden ? Math.max(0, (cached.suggestedMarks || 8) - 3) : undefined;

      await db.collection('aiCalls').add({
        sheetId: sheet.id,
        qNo,
        questionText: qObj.text,
        maxMarks: qObj.maxMarks,
        imageHash: 'cached',
        prompt: `Evaluate question ${qNo}`,
        response: cached,
        decision: {
          type: decisionType,
          overrideMarks,
          note: isOverridden ? 'Adjusted marks per student specific wording' : 'Accepted AI grading recommendation'
        },
        status: 'success',
        source: 'cached_file',
        requestedBy: examiner,
        processingTimeMs: 15 + (i * 3),
        createdAt: new Date(Date.now() - (40 - i) * 3 * 60 * 60 * 1000).toISOString()
      });
    }

    // Moderation records (moderator adjustments for analytics calculation)
    console.log('  ⚖️  Seeding moderation adjustment records...');
    const flaggedSheets = allSheets.filter(s => s.status === SheetStatus.FLAGGED);
    for (let m = 0; m < Math.min(flaggedSheets.length, 3); m++) {
      const fSheet = flaggedSheets[m];
      await db.collection('moderation').add({
        sheetId: fSheet.id,
        moderatorId: moderatorUid,
        action: 'adjust',
        reason: 'Adjusted after peer anomaly review',
        adjustedMarks: [{ qNo: 1, marks: 8, comment: 'Moderator verified' }],
        createdAt: getCurrentTimestamp()
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • Users: ${DEMO_USERS.length}`);
    console.log(`   • Exams: 1 (${exam.title})`);
    console.log(`   • Total Sheets: ${allSheets.length + 1} (including 4 calibration sheets)`);
    console.log(`   • Historical Audit Entries: ${auditSeq - 1}`);
    console.log(`   • Historical AI calls: 40+`);
    console.log('\n🎯 Examiner Profiles Active:');
    console.log('   • E1: Normal baseline (~72% marks, 120-180s per q)');
    console.log('   • E2: Generous (P1 Peer Deviation alert, mean 95%)');
    console.log('   • E3: Rushed (A5 Time Anomaly < 30s & P5 Speed Drift > 50%)');
    console.log('   • E4: Repeated totals (P2 alert, identical total 68 on 36% of sheets)');
    console.log('   • E5: Calibration drift (P4 alert, 0% match with Gold Marks)');
    console.log('\n📍 Planted Edge Test Cases:');
    console.log('   • Over-maximum mark (A3): Q2 awarded 18/15');
    console.log('   • Unmarked question (A1): Q3 unmarked on evaluated sheet');
    console.log('   • Unviewed page: UNVIEWED_PAGE alert on Page 4');
    console.log('   • Large AI-vs-examiner gap: AI suggested 14, examiner gave 4 (Gap = 10)');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
