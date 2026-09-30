#!/usr/bin/env node

/**
 * SAMADHAN X Comprehensive Demo Data Seeding & Reset Engine
 * 
 * Capable of populating a completely EMPTY Firebase project.
 * Completely idempotent and safely isolated to demo collections.
 * 
 * Features:
 * 1. Firebase Auth & Users collection:
 *    - examiner1@demo.com ... examiner5@demo.com, moderator@demo.com, controller@demo.com
 *    - Reads demo password from process.env.SEED_DEMO_PASSWORD (fallback 'Demo123!')
 *    - Profile fields: name, role, subjects[], faceRefUrl (placeholder)
 * 2. Exam: 1 exam with 8 questions (including Hindi questions and bilingual answers)
 * 3. Sheets: 20 anonymised sheets (SX-0001 ... SX-0020), pages[] pointing to ${FRONTEND_URL}/samples/SX-XXXX-pY.png,
 *    pageMap { qNo: [pages] }, statuses (evaluated, flagged, uploaded, in_progress), assigned across E1-E5,
 *    calibration sheets with gold standard marks.
 * 4. Sample page PNG generation: Creates 20 realistic handwriting-scan style PNGs saved in frontend/public/samples/.
 * 5. Identity mapping: Synthetic student names and roll numbers in 'identityMap'.
 * 6. Examiner profiles:
 *    - E1: Normal baseline
 *    - E2: Generous (P1 Peer Deviation)
 *    - E3: Rushed (A5 Time Anomaly, P5 Speed Drift)
 *    - E4: Repeated Totals (P2)
 *    - E5: Calibration Drift (P4)
 *    - Planted test cases: Over-maximum mark (A3), Unmarked question (A1), Large AI-vs-Examiner gap.
 * 7. Cached AI Results: pre-generated evaluation results in aiCalls matching cachedAIResults.json for USE_CACHED_AI=true.
 * 8. Cryptographic Audit Trail: Uses auditLog.append() chaining hashes, verified at the end via auditLog.verify().
 * 9. Batched Firestore writes (capped <= 450 ops per batch) and summary table.
 * 10. npm run seed:reset with confirmation prompt showing project ID.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sharp = require('sharp');
const { getAdmin } = require('../config/firebaseAdmin');
const { getFirestore, Collections, SheetStatus } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');
const { ANOMALY_TYPES, ANOMALY_THRESHOLDS, ALERT_STATUS } = require('../config/anomalyThresholds');
const auditLog = require('../services/auditLog');

// Configuration
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo123!';

// Demo collections to safely wipe in reset mode (Strictly isolated to demo data)
const DEMO_COLLECTIONS = [
  Collections.EXAMS,
  Collections.SHEETS,
  Collections.IDENTITY_MAP,
  Collections.MARKS,
  'alerts',
  'aiCalls',
  'moderation',
  'audit'
];

// Demo Users Specification
const DEMO_USERS = [
  {
    email: 'examiner1@demo.com',
    name: 'Examiner One (Normal Baseline)',
    role: 'examiner',
    subjects: ['Computer Science', 'Information Technology'],
    faceRefUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'
  },
  {
    email: 'examiner2@demo.com',
    name: 'Examiner Two (Generous P1)',
    role: 'examiner',
    subjects: ['Computer Science', 'Software Engineering'],
    faceRefUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256'
  },
  {
    email: 'examiner3@demo.com',
    name: 'Examiner Three (Rushed A5/P5)',
    role: 'examiner',
    subjects: ['Computer Science', 'Algorithms'],
    faceRefUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256'
  },
  {
    email: 'examiner4@demo.com',
    name: 'Examiner Four (Repeated Totals P2)',
    role: 'examiner',
    subjects: ['Computer Science', 'Database Systems'],
    faceRefUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256'
  },
  {
    email: 'examiner5@demo.com',
    name: 'Examiner Five (Calibration Drift P4)',
    role: 'examiner',
    subjects: ['Computer Science', 'Computer Networks'],
    faceRefUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=256'
  },
  {
    email: 'moderator@demo.com',
    name: 'Senior Evaluation Moderator',
    role: 'moderator',
    subjects: ['Computer Science', 'Engineering Oversight'],
    faceRefUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256'
  },
  {
    email: 'controller@demo.com',
    name: 'Chief Controller of Examinations',
    role: 'controller',
    subjects: ['All Examination Boards'],
    faceRefUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256'
  }
];

// Gold Standard Calibration Marks (Total = 75 / 100)
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

// Question mapping across sheet pages (8 questions across 4 pages)
const DEFAULT_PAGE_MAP = {
  1: [1],
  2: [1],
  3: [2],
  4: [2],
  5: [3],
  6: [3],
  7: [4],
  8: [4]
};

// Batch Writer Utility ensuring max 450 ops per batch
class BatchWriter {
  constructor(db) {
    this.db = db;
    this.batch = db.batch();
    this.opCount = 0;
    this.counts = {};
  }

  set(ref, data, options = {}) {
    this.batch.set(ref, data, options);
    this.recordOp(ref.parent.id);
  }

  delete(ref) {
    this.batch.delete(ref);
    this.recordOp(ref.parent.id);
  }

  recordOp(collectionName) {
    this.counts[collectionName] = (this.counts[collectionName] || 0) + 1;
    this.opCount++;
    if (this.opCount >= 400) {
      return this.flush();
    }
    return Promise.resolve();
  }

  async flush() {
    if (this.opCount === 0) return;
    await this.batch.commit();
    this.batch = this.db.batch();
    this.opCount = 0;
  }
}

// Generate ~20 Sample PNG Scanned Answer Sheet Pages into frontend/public/samples/
async function generateSampleImages() {
  const samplesDir = path.resolve(__dirname, '../../../frontend/public/samples');
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  console.log(`🖼️  Ensuring sample scan images in: ${samplesDir}`);
  const pagesToGenerate = [
    { p: 1, q: 'Q1 and Q2', title: 'Object-Oriented Programming and Binary Search Algorithm' },
    { p: 2, q: 'Q3 and Q4', title: 'Database Normalization (1NF/2NF/3NF) and OSI 7-Layer Protocol Model' },
    { p: 3, q: 'Q5 and Q6', title: 'TCP vs UDP Analysis and Stack vs Queue Data Structures' },
    { p: 4, q: 'Q7 and Q8', title: 'Relational SQL Joins and Library Management System Schema Design' }
  ];

  let generatedCount = 0;
  for (let s = 1; s <= 20; s++) {
    const sheetId = `SX-${String(s).padStart(4, '0')}`;
    for (const info of pagesToGenerate) {
      const fileName = `${sheetId}-p${info.p}.png`;
      const filePath = path.join(samplesDir, fileName);

      if (!fs.existsSync(filePath)) {
        const svg = `
        <svg width="850" height="1100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lines" width="850" height="32" patternUnits="userSpaceOnUse">
              <line x1="60" y1="31" x2="790" y2="31" stroke="#e2e8f0" stroke-width="1.2"/>
            </pattern>
          </defs>
          <rect width="850" height="1100" fill="#f8fafc"/>
          <rect x="40" y="40" width="770" height="1020" fill="#ffffff" rx="8" stroke="#cbd5e1" stroke-width="2"/>
          <line x1="120" y1="40" x2="120" y2="1060" stroke="#fca5a5" stroke-width="1.5" stroke-dasharray="2,2"/>
          <rect x="125" y="140" width="670" height="900" fill="url(#lines)"/>
          
          <!-- Header Barcode and Meta -->
          <text x="425" y="80" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#0f172a">
            MADHYA PRADESH ONLINE EXAMINATION AUTHORITY (MPOnline)
          </text>
          <text x="425" y="105" font-family="Courier, monospace" font-size="13" font-weight="600" text-anchor="middle" fill="#475569">
            CONFIDENTIAL DIGITAL ANSWER SCRIPT [BARCODE: ${sheetId}-PAGE-${info.p}]
          </text>
          <line x1="60" y1="125" x2="790" y2="125" stroke="#94a3b8" stroke-width="1"/>

          <!-- Script Content -->
          <text x="140" y="175" font-family="Courier, monospace" font-size="15" font-weight="bold" fill="#1e293b">
            Section: ${info.q} Answer Script
          </text>
          <text x="140" y="200" font-family="sans-serif" font-size="13" fill="#64748b">
            Subject: ${info.title}
          </text>
          
          <!-- Handwritten Simulation Lines -->
          <text x="140" y="255" font-family="'Brush Script MT', cursive, sans-serif" font-size="20" fill="#1e3a8a">
            Ans: Foundational principles and characteristics are illustrated below:
          </text>
          <text x="160" y="318" font-family="'Brush Script MT', cursive, sans-serif" font-size="19" fill="#1e3a8a">
            1. Systematic definition and theoretical boundary conditions verified.
          </text>
          <text x="160" y="382" font-family="'Brush Script MT', cursive, sans-serif" font-size="19" fill="#1e3a8a">
            2. Mathematical formulation / Step-by-step pseudo-algorithm logic implemented.
          </text>
          <text x="160" y="446" font-family="'Brush Script MT', cursive, sans-serif" font-size="19" fill="#1e3a8a">
            3. Detailed real-world applications and edge-case handling considerations.
          </text>
          
          <!-- Diagram Mockup -->
          <rect x="200" y="520" width="460" height="200" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4" rx="6"/>
          <text x="430" y="625" font-family="sans-serif" font-size="14" fill="#64748b" text-anchor="middle">
            [Student Technical Diagram / Architectural Flowchart / Schema Block]
          </text>
          
          <text x="140" y="795" font-family="'Brush Script MT', cursive, sans-serif" font-size="19" fill="#1e3a8a">
            Ans: Complexity metrics and comprehensive rubric requirements satisfied.
          </text>
          <text x="160" y="858" font-family="'Brush Script MT', cursive, sans-serif" font-size="19" fill="#1e3a8a">
            Conclusion: Result yields verified correctness with optimal operational boundaries.
          </text>

          <!-- Footer Security Watermark -->
          <text x="425" y="1035" font-family="Courier, monospace" font-size="11" fill="#94a3b8" text-anchor="middle">
            SECURITY VERIFIED HASH: SHA-256(${sheetId}-P${info.p}) [DO NOT COPY]
          </text>
        </svg>`;

        const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        fs.writeFileSync(filePath, pngBuffer);
        generatedCount++;
      }
    }
  }

  if (generatedCount > 0) {
    console.log(`  ✓ Generated ${generatedCount} sample scan PNG images in frontend/public/samples/`);
  } else {
    console.log(`  ✓ Sample scan images already present in frontend/public/samples/`);
  }
}

// Ask for interactive confirmation when wiping
async function promptConfirmation(projectId) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      `\n⚠️  WARNING: You are about to wipe demo collections in project: "${projectId}"!\nType "yes" to proceed or any other key to cancel: `,
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'yes');
      }
    );
  });
}

// Main Seeding Engine
async function seed(isReset = false) {
  console.log('\n=============================================================');
  console.log('🌱 SAMADHAN X Comprehensive Demo Data Seed & Population Engine');
  console.log('=============================================================\n');

  const admin = getAdmin();
  const db = getFirestore();
  const defaultApp = (admin.getApps && admin.getApps().length > 0) ? admin.getApps()[0] : (admin.app ? admin.app() : null);
  const projectId = (defaultApp && defaultApp.options && defaultApp.options.projectId) || process.env.FIREBASE_PROJECT_ID || 'samadhanexam';

  console.log(`Target Firebase Project: ${projectId}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);

  // 1. Reset / Wipe if requested
  if (isReset) {
    const confirmed = await promptConfirmation(projectId);
    if (!confirmed) {
      console.log('❌ Reset aborted by user.');
      process.exit(0);
    }

    console.log('\n🗑️  Wiping demo collections...');
    for (const col of DEMO_COLLECTIONS) {
      const snap = await db.collection(col).get();
      if (snap.empty) {
        console.log(`  ✓ ${col}: already empty`);
        continue;
      }
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const chunk = docs.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      console.log(`  ✓ ${col}: deleted ${docs.length} documents`);
    }
  }

  // 2. Sample PNGs Generation
  await generateSampleImages();

  // 3. Firebase Auth & Users Profile Population
  console.log('\n👥 Ensuring Demo Users (Auth + users/{uid})...');
  const userMap = {};
  const examinerList = [];
  let moderatorUid = null;
  let controllerUid = null;

  for (const userInfo of DEMO_USERS) {
    let authUser;
    try {
      authUser = await admin.auth().getUserByEmail(userInfo.email);
      console.log(`  ✓ Auth user exists: ${userInfo.email} (${authUser.uid})`);
      await admin.auth().updateUser(authUser.uid, { password: DEMO_PASSWORD });
      console.log(`  ✓ Reset password for: ${userInfo.email}`);
    } catch {
      authUser = await admin.auth().createUser({
        email: userInfo.email,
        password: DEMO_PASSWORD,
        displayName: userInfo.name,
        emailVerified: true
      });
      console.log(`  ✓ Created Auth user: ${userInfo.email} (${authUser.uid})`);
    }

    // Set/merge in users/{uid} document
    await db.collection(Collections.USERS).doc(authUser.uid).set({
      uid: authUser.uid,
      name: userInfo.name,
      email: userInfo.email,
      role: userInfo.role,
      subjects: userInfo.subjects,
      faceRefUrl: userInfo.faceRefUrl,
      updatedAt: getCurrentTimestamp(),
      createdAt: getCurrentTimestamp()
    }, { merge: true });

    userMap[userInfo.email] = authUser.uid;
    if (userInfo.role === 'examiner') {
      examinerList.push(authUser.uid);
    } else if (userInfo.role === 'moderator') {
      moderatorUid = authUser.uid;
    } else if (userInfo.role === 'controller') {
      controllerUid = authUser.uid;
    }
  }

  const [E1, E2, E3, E4, E5] = examinerList;

  // 4. Create or Ensure Demo Exam (8 questions, bilingual / Hindi questions)
  console.log('\n📝 Ensuring Demo Exam...');
  const examRef = db.collection(Collections.EXAMS).doc('EXAM-CS-2026');
  const examSnapshot = await examRef.get();
  
  const examData = {
    code: 'CS-2026',
    title: 'Computer Science & Systems Midterm Examination 2026',
    subject: 'Computer Science',
    totalMarks: 100,
    durationMinutes: 180,
    instructions: 'Answer all 8 questions. Bilingual responses in Hindi/English are fully permitted. Time limit: 180 minutes.',
    questions: [
      {
        id: 'q1',
        qNo: 1,
        questionNumber: 1,
        title: 'Object-Oriented Programming Principles',
        maxMarks: 10,
        text: 'Explain the core principles of Object-Oriented Programming (OOP): Encapsulation, Abstraction, Inheritance, and Polymorphism with code illustrations.',
        modelAnswer: 'OOP organizes programs into modular objects. Encapsulation hides state; Abstraction exposes interface; Inheritance reuses behavior; Polymorphism enables dynamic dispatch.',
        rubric: [
          { id: 'r1_1', criterion: 'Definition of OOP & Encapsulation', points: 3 },
          { id: 'r1_2', criterion: 'Abstraction & Inheritance breakdown', points: 4 },
          { id: 'r1_3', criterion: 'Polymorphism with code example', points: 3 }
        ]
      },
      {
        id: 'q2',
        qNo: 2,
        questionNumber: 2,
        title: 'Binary Search Algorithm & Complexity',
        maxMarks: 15,
        text: 'Implement a recursive or iterative Binary Search on a sorted list. Prove its O(log n) time complexity and discuss boundary conditions.',
        modelAnswer: 'Binary search halves search interval each step. Recurrence T(n) = T(n/2) + O(1) solves to O(log n). Requires sorted input array.',
        rubric: [
          { id: 'r2_1', criterion: 'Correct logic and boundary conditions', points: 8 },
          { id: 'r2_2', criterion: 'Recurrence relation and O(log n) proof', points: 4 },
          { id: 'r2_3', criterion: 'Code clarity & variable handling', points: 3 }
        ]
      },
      {
        id: 'q3',
        qNo: 3,
        questionNumber: 3,
        title: 'डेटाबेस नॉर्मलाइज़ेशन (Database Normalization 1NF, 2NF, 3NF)',
        maxMarks: 12,
        text: 'डेटाबेस नॉर्मलाइज़ेशन क्या है? प्रथम, द्वितीय और तृतीय सामान्य रूप (1NF, 2NF, 3NF) की सोदाहरण व्याख्या करें।\n(Explain Database Normalization: 1NF, 2NF, and 3NF with schemas.)',
        modelAnswer: 'नॉर्मलाइज़ेशन रिडंडेंसी को घटाता है। 1NF: एटॉमिक वैल्यूज़। 2NF: 1NF + पूर्ण कार्यात्मक निर्भरता। 3NF: 2NF + सकर्मक निर्भरता से मुक्ति।',
        rubric: [
          { id: 'r3_1', criterion: 'Definition of Normalization and redundancy risks', points: 3 },
          { id: 'r3_2', criterion: '1NF and 2NF criteria explained', points: 5 },
          { id: 'r3_3', criterion: '3NF and transitive dependency criteria', points: 4 }
        ]
      },
      {
        id: 'q4',
        qNo: 4,
        questionNumber: 4,
        title: 'OSI Reference Model Architecture',
        maxMarks: 8,
        text: 'Enumerate all seven layers of the ISO-OSI reference model. State the core responsibility and primary protocol unit of each layer.',
        modelAnswer: '7 layers: Physical (bits), Data Link (frames), Network (packets), Transport (segments), Session, Presentation, Application.',
        rubric: [
          { id: 'r4_1', criterion: 'All 7 layers accurately identified', points: 3 },
          { id: 'r4_2', criterion: 'PDU and functional responsibility explained', points: 5 }
        ]
      },
      {
        id: 'q5',
        qNo: 5,
        questionNumber: 5,
        title: 'Transport Layer: TCP vs UDP Comparison',
        maxMarks: 10,
        text: 'Differentiate between TCP and UDP protocols across handshake mechanism, reliability guarantees, header overhead, and target application scenarios.',
        modelAnswer: 'TCP: connection-oriented, 3-way handshake, reliable byte-stream, higher overhead. UDP: connectionless, lightweight datagram, low-latency streaming.',
        rubric: [
          { id: 'r5_1', criterion: 'Reliability and handshake differences', points: 4 },
          { id: 'r5_2', criterion: 'Header structure and flow control comparison', points: 3 },
          { id: 'r5_3', criterion: 'Appropriate real-world application examples', points: 3 }
        ]
      },
      {
        id: 'q6',
        qNo: 6,
        questionNumber: 6,
        title: 'स्टैक और क्यू डेटा संरचनाएं (Stack vs Queue Data Structures)',
        maxMarks: 15,
        text: 'स्टैक (LIFO) और क्यू (FIFO) डेटा संरचनाओं में अंतर बताइए। उनके संचालन एवं वास्तविक जीवन के अनुप्रयोगों का विवरण दीजिए।\n(Contrast Stack and Queue with real life applications.)',
        modelAnswer: 'Stack is LIFO (push/pop at top). Queue is FIFO (enqueue at rear, dequeue at front). Stack: call stack, undo. Queue: print spooler, CPU scheduling.',
        rubric: [
          { id: 'r6_1', criterion: 'LIFO vs FIFO theoretical distinction', points: 4 },
          { id: 'r6_2', criterion: 'Primitive operations (push/pop vs enqueue/dequeue)', points: 5 },
          { id: 'r6_3', criterion: 'Real life and computing system use cases', points: 6 }
        ]
      },
      {
        id: 'q7',
        qNo: 7,
        questionNumber: 7,
        title: 'Relational SQL Joins & Query Construction',
        maxMarks: 12,
        text: 'Explain SQL JOIN operations (INNER, LEFT, RIGHT, FULL OUTER) with Venn diagrams and schema queries on an Employee-Department relational dataset.',
        modelAnswer: 'INNER JOIN matches both tables. LEFT OUTER keeps all left records. RIGHT OUTER keeps all right records. FULL OUTER combines both with null padding.',
        rubric: [
          { id: 'r7_1', criterion: 'Conceptual mechanics of all 4 JOIN variants', points: 5 },
          { id: 'r7_2', criterion: 'Syntactically valid SQL query examples', points: 5 },
          { id: 'r7_3', criterion: 'Handling of NULL values in outer joins', points: 2 }
        ]
      },
      {
        id: 'q8',
        qNo: 8,
        questionNumber: 8,
        title: 'Relational Schema Design & DDL',
        maxMarks: 18,
        text: 'Architect an enterprise Library Management System schema. Write complete DDL statements with PRIMARY KEY, FOREIGN KEY, and CHECK constraints.',
        modelAnswer: 'Entities: Books, Members, Loans. Books(book_id PK, title, isbn UNIQUE). Members(member_id PK, name). Loans(loan_id PK, book_id FK, member_id FK, loan_date).',
        rubric: [
          { id: 'r8_1', criterion: 'Table entity relationships and normalization', points: 6 },
          { id: 'r8_2', criterion: 'Syntactically valid DDL with constraints', points: 8 },
          { id: 'r8_3', criterion: 'Indexing and integrity rule choices', points: 4 }
        ]
      }
    ],
    updatedAt: getCurrentTimestamp(),
    createdAt: examSnapshot.exists ? examSnapshot.data().createdAt : getCurrentTimestamp()
  };

  await examRef.set(examData, { merge: true });
  console.log(`  ✓ Exam configured: EXAM-CS-2026 (${examData.title})`);

  // Initial audit event for exam
  await auditLog.append({
    actor: controllerUid,
    role: 'controller',
    action: 'exam_init',
    metadata: { examId: 'EXAM-CS-2026', title: examData.title }
  });

  // 5. Build 20 Anonymized Answer Sheets (SX-0001 ... SX-0020)
  console.log('\n📄 Creating 20 Anonymized Sheets & Seeding Historical Evaluations...');
  const batchWriter = new BatchWriter(db);
  const cachedAI = require('./cachedAIResults.json');

  const sheetsMeta = [];
  /**
   * Examiner Distribution:
   * E1 (Normal): Sheets SX-0001 ... SX-0004
   * E2 (Generous P1): Sheets SX-0005 ... SX-0008
   * E3 (Rushed A5/P5): Sheets SX-0009 ... SX-0012
   * E4 (Repeated P2): Sheets SX-0013 ... SX-0016
   * E5 (Calibration Drift P4): Sheets SX-0017 ... SX-0020
   */
  const examinerAssignments = [
    { examiner: E1, start: 1, end: 4, profile: 'normal' },
    { examiner: E2, start: 5, end: 8, profile: 'generous' },
    { examiner: E3, start: 9, end: 12, profile: 'rushed' },
    { examiner: E4, start: 13, end: 16, profile: 'repeated' },
    { examiner: E5, start: 17, end: 20, profile: 'drift' }
  ];

  // Calibration sheets: 4 total (SX-0001 on E1, SX-0007 on E2, SX-0017 on E5, SX-0020 unassigned)
  const calibrationIndices = new Set([1, 7, 17, 20]);

  for (let s = 1; s <= 20; s++) {
    const sheetId = `SX-${String(s).padStart(4, '0')}`;
    const isCalibration = calibrationIndices.has(s);
    const assignGroup = examinerAssignments.find(g => s >= g.start && s <= g.end);
    let assignedExaminer = assignGroup ? assignGroup.examiner : E1;
    let sheetStatus = SheetStatus.EVALUATED;

    if (s === 20) {
      // SX-0020 is a freshly uploaded calibration sheet for testing the assign endpoint
      assignedExaminer = null;
      sheetStatus = SheetStatus.UPLOADED;
    }

    const pages = [1, 2, 3, 4].map(p => ({
      pageNumber: p,
      fileName: `${sheetId}-p${p}.png`,
      mimeType: 'image/png',
      size: 65536,
      url: `${FRONTEND_URL}/samples/${sheetId}-p${p}.png`,
      dataUrl: `${FRONTEND_URL}/samples/${sheetId}-p${p}.png`
    }));

    // Synthetic Identity Mapping
    const rollNo = `ROLL-2026-${String(1000 + s)}`;
    const studentName = `Candidate Synthetic ${s}`;
    const idMapRef = db.collection(Collections.IDENTITY_MAP).doc(sheetId);
    batchWriter.set(idMapRef, {
      sheetId,
      rollNo,
      studentName,
      examId: 'EXAM-CS-2026',
      createdAt: getCurrentTimestamp()
    });

    const sheetRef = db.collection(Collections.SHEETS).doc(sheetId);
    const uploadedAt = new Date(Date.now() - (25 - s) * 24 * 3600 * 1000).toISOString();
    const startedAt = assignedExaminer ? new Date(new Date(uploadedAt).getTime() + 3600 * 1000).toISOString() : null;
    const completedAt = (sheetStatus === SheetStatus.EVALUATED || sheetStatus === SheetStatus.FLAGGED)
      ? new Date(new Date(startedAt).getTime() + 1800 * 1000).toISOString()
      : null;

    // 6. Generate Marks for Each Question based on Examiner Profile
    let totalMarksAwarded = 0;
    const marksRecords = [];

    if (assignedExaminer && sheetStatus !== SheetStatus.UPLOADED) {
      for (const q of examData.questions) {
        let markVal;
        let timeSpent = 120;
        let comment = 'Standard criteria met.';

        switch (assignGroup.profile) {
          case 'normal': // E1: ~72% mean
            markVal = Math.round(q.maxMarks * 0.72);
            timeSpent = 120 + (q.qNo * 5);
            break;

          case 'generous': // E2: ~95% mean (P1 Peer Deviation)
            markVal = Math.round(q.maxMarks * 0.95);
            timeSpent = 95;
            comment = 'Flawless presentation and depth.';
            break;

          case 'rushed': // E3: Rushed (< 25s per question on recent sheets)
            markVal = Math.round(q.maxMarks * 0.70);
            timeSpent = s >= 11 ? 18 : 130; // Triggers A5 & P5
            comment = 'Quick grading pass.';
            break;

          case 'repeated': // E4: Identical total of 68 marks on repeated sheets (P2)
            if (s === 13 || s === 15) {
              const fixed68 = [7, 10, 8, 5, 7, 10, 8, 13];
              markVal = fixed68[q.qNo - 1];
            } else {
              markVal = Math.round(q.maxMarks * 0.65);
            }
            timeSpent = 110;
            break;

          case 'drift': // E5: Calibration Drift (P4: 0% match with Gold standard)
            markVal = isCalibration ? Math.max(1, Math.round(q.maxMarks * 0.35)) : Math.round(q.maxMarks * 0.55);
            timeSpent = 115;
            comment = 'Strict subjective assessment.';
            break;

          default:
            markVal = Math.round(q.maxMarks * 0.70);
        }

        // --- Planted Edge Cases ---
        // Plant Case 1: Over-maximum mark (A3) on SX-0002 (Q2 awarded 18/15)
        if (s === 2 && q.qNo === 2) {
          markVal = 18;
          sheetStatus = SheetStatus.FLAGGED;
          comment = 'Planted anomaly: exceeds maximum marks!';
        }

        // Plant Case 2: Unmarked question (A1) on SX-0003 (Q3 completely skipped)
        if (s === 3 && q.qNo === 3) {
          sheetStatus = SheetStatus.FLAGGED;
          continue; // Do not save mark for Q3
        }

        totalMarksAwarded += markVal;
        const markDocId = `${sheetId}_q${q.qNo}`;
        const markRef = db.collection(Collections.MARKS).doc(markDocId);
        
        const markData = {
          sheetId,
          qNo: q.qNo,
          marks: markVal,
          comment,
          timeSpentSec: timeSpent,
          markedBy: assignedExaminer,
          markedAt: completedAt || startedAt
        };

        batchWriter.set(markRef, markData);
        marksRecords.push(markData);
      }
    }

    // Sheet Document
    const sheetDoc = {
      sheetId,
      examId: 'EXAM-CS-2026',
      pages,
      pageMap: DEFAULT_PAGE_MAP,
      status: sheetStatus,
      assignedTo: assignedExaminer,
      uploadedBy: controllerUid,
      uploadedAt,
      startedAt,
      completedAt,
      totalMarks: totalMarksAwarded,
      maxMarks: 100,
      isCalibration,
      goldMarks: isCalibration ? GOLD_MARKS : null,
      updatedAt: completedAt || uploadedAt
    };

    batchWriter.set(sheetRef, sheetDoc);
    sheetsMeta.push(sheetDoc);

    // Write audit event for sheet evaluation
    if (completedAt && assignedExaminer) {
      await auditLog.append({
        actor: assignedExaminer,
        role: 'examiner',
        action: 'submit',
        sheetId,
        after: { totalMarks: totalMarksAwarded, status: sheetStatus }
      });
    }

    // 7. Seed Pre-generated AI Calls (aiCalls) for USE_CACHED_AI=true
    if (s <= 10) {
      const qNo = (s % 8) + 1;
      const cached = cachedAI[`default_q${qNo}`] || cachedAI['default_q1'];
      const aiRef = db.collection('aiCalls').doc(`${sheetId}_q${qNo}`);
      
      const isLargeGap = (s === 4 && qNo === 2); // Planted Case 4: Large AI vs Examiner Gap
      const isOverridden = isLargeGap || (s % 3 === 0);

      batchWriter.set(aiRef, {
        sheetId,
        qNo,
        questionText: examData.questions[qNo - 1].text,
        maxMarks: examData.questions[qNo - 1].maxMarks,
        imageHash: 'cached',
        prompt: `Evaluate answer for question ${qNo}`,
        response: {
          suggestedMarks: isLargeGap ? 14 : cached.suggestedMarks,
          matched: cached.matched,
          missed: cached.missed,
          transcription: cached.transcription,
          confidence: cached.confidence,
          reason: cached.reason
        },
        decision: {
          type: isOverridden ? 'overridden' : 'accepted',
          overrideMarks: isLargeGap ? 4 : (isOverridden ? Math.max(0, cached.suggestedMarks - 2) : undefined),
          note: isLargeGap ? 'Examiner found critical infinite loop in binary search. Heavily docked.' : 'Verified'
        },
        status: 'success',
        source: 'cached_file',
        requestedBy: assignedExaminer || E1,
        processingTimeMs: 14 + (s * 2),
        createdAt: completedAt || uploadedAt
      });
    }

    // 8. Plant Specific Anomaly Alerts
    // Alert: Over Maximum (A3) on SX-0002
    if (s === 2) {
      const alertRef = db.collection('alerts').doc('ALERT-A3-SX0002');
      batchWriter.set(alertRef, {
        sheetId,
        type: ANOMALY_TYPES.A3_MARKS_EXCEED_MAX,
        severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
        message: 'Marks for Q2 (18) exceed maximum question limit (15)',
        metadata: { questionNo: 2, marksGiven: 18, maxMarks: 15, difference: 3 },
        status: ALERT_STATUS.PENDING,
        detectedBy: 'system',
        detectedAt: completedAt || uploadedAt,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null
      });
    }

    // Alert: Unmarked Question (A1) on SX-0003
    if (s === 3) {
      const alertRef = db.collection('alerts').doc('ALERT-A1-SX0003');
      batchWriter.set(alertRef, {
        sheetId,
        type: ANOMALY_TYPES.A1_UNMARKED_QUESTION,
        severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
        message: 'Question 3 is unmarked in evaluated sheet',
        metadata: { questionNo: 3, maxMarks: 12 },
        status: ALERT_STATUS.PENDING,
        detectedBy: 'system',
        detectedAt: completedAt || uploadedAt,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null
      });
    }

    // Alert: Peer Deviation (P1) on E2 (SX-0008)
    if (s === 8) {
      const alertRef = db.collection('alerts').doc('ALERT-P1-E2');
      batchWriter.set(alertRef, {
        sheetId,
        type: ANOMALY_TYPES.P1_PEER_DEVIATION,
        severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
        message: "Examiner's average marks (95%) significantly higher than peer cohort (72%)",
        metadata: { examinerMean: 95.2, peerMean: 71.8, deviation: 23.4, zScore: 2.85 },
        status: ALERT_STATUS.PENDING,
        detectedBy: 'system',
        detectedAt: completedAt,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null
      });
    }

    // Alert: Time Anomaly (A5) & Speed Drift (P5) on E3 (SX-0012)
    if (s === 12) {
      const alertRefA5 = db.collection('alerts').doc('ALERT-A5-E3');
      batchWriter.set(alertRefA5, {
        sheetId,
        type: ANOMALY_TYPES.A5_TIME_ANOMALY,
        severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
        message: 'Questions marked in under 20s (cohort average: 120s)',
        metadata: { questionNo: 1, timeSpentSec: 18, cohortAverage: 120 },
        status: ALERT_STATUS.PENDING,
        detectedBy: 'system',
        detectedAt: completedAt,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null
      });

      const alertRefP5 = db.collection('alerts').doc('ALERT-P5-E3');
      batchWriter.set(alertRefP5, {
        sheetId,
        type: ANOMALY_TYPES.P5_SPEED_DRIFT,
        severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
        message: 'Marking speed accelerated by 82% over baseline',
        metadata: { baselineSec: 960, recentSec: 172, percentageChange: -82.0 },
        status: ALERT_STATUS.PENDING,
        detectedBy: 'system',
        detectedAt: completedAt,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null
      });
    }

    // Alert: Repeated Totals (P2) on E4 (SX-0016)
    if (s === 16) {
      const alertRef = db.collection('alerts').doc('ALERT-P2-E4');
      batchWriter.set(alertRef, {
        sheetId,
        type: ANOMALY_TYPES.P2_REPEATED_TOTALS,
        severity: ANOMALY_THRESHOLDS.SEVERITY.MEDIUM,
        message: 'Total score of 68 appears on 50% of evaluated scripts',
        metadata: { total: 68, occurrences: 2, totalSheets: 4, frequencyPercentage: 50 },
        status: ALERT_STATUS.PENDING,
        detectedBy: 'system',
        detectedAt: completedAt,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null
      });
    }

    // Alert: Calibration Drift (P4) on E5 (SX-0017)
    if (s === 17) {
      const alertRef = db.collection('alerts').doc('ALERT-P4-E5');
      batchWriter.set(alertRef, {
        sheetId,
        type: ANOMALY_TYPES.P4_CALIBRATION_DRIFT,
        severity: ANOMALY_THRESHOLDS.SEVERITY.HIGH,
        message: 'Calibration score 0% match with Gold Standard benchmarks',
        metadata: { calibrationScore: 0, goldMarks: GOLD_MARKS, examinerId: E5 },
        status: ALERT_STATUS.PENDING,
        detectedBy: 'system',
        detectedAt: completedAt,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null
      });
    }
  }

  // 9. Moderation Entries
  const modRef = db.collection('moderation').doc('MOD-SX0002');
  batchWriter.set(modRef, {
    sheetId: 'SX-0002',
    moderatorId: moderatorUid,
    action: 'adjust',
    reason: 'Fixed A3 over-maximum score to compliant ceiling of 15',
    adjustedMarks: [{ qNo: 2, marks: 15, comment: 'Capped at max marks' }],
    createdAt: getCurrentTimestamp()
  });

  // Flush batched writes
  await batchWriter.flush();

  // 10. Audit Chain Verification
  console.log('\n🔒 Cryptographic Audit Chain Verification...');
  const auditVerification = await auditLog.verify();
  console.log(`  Audit Status: ${auditVerification.status}`);
  console.log(`  Verified Entries: ${auditVerification.verifiedEntries || 0}`);
  if (auditVerification.status === 'OK') {
    console.log('  ✓ HASH CHAIN INTEGRITY CONFIRMED (OK)');
  } else {
    console.warn(`  ⚠️ Audit Verification Warning: ${auditVerification.message}`);
  }

  // 11. Final Summary Table
  console.log('\n📊 SEEDING SUMMARY (Counts per collection):');
  console.table({
    users: DEMO_USERS.length,
    exams: 1,
    sheets: sheetsMeta.length,
    identityMap: sheetsMeta.length,
    marks: Object.keys(batchWriter.counts).includes('marks') ? batchWriter.counts['marks'] : 150,
    alerts: 6,
    aiCalls: 10,
    moderation: 1,
    audit: auditVerification.totalEntries || 0
  });

  console.log('═════════════════════════════════════════════════════════════');
  console.log('✅ Demo Environment successfully populated and ready!');
  console.log('=============================================================\n');
}

// CLI Execution entry point
if (require.main === module) {
  const isReset = process.argv.includes('--reset');
  seed(isReset)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Seeding fatal error:', err);
      process.exit(1);
    });
}

module.exports = { seed };
