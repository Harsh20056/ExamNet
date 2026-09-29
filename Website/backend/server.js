require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  }
});

// In-memory mock database
let students = [];
let activeCenterId = 1;
let nextId = 1;

// Intent Status Calculation Helper
function calculateCompletionSignal(testSession) {
  const isLocked = !!testSession.isLocked;
  const prerequisitesMissing = !!testSession.prerequisitesMissing;
  const isDraft = !!testSession.isDraft;
  const pendingManualReview = !!testSession.pendingManualReview;
  const attemptedQuestions = testSession.attemptedQuestions || 0;
  const totalQuestions = testSession.totalQuestions || 5;

  if (isLocked || prerequisitesMissing) {
    return {
      status: 'Blocked',
      reason: isLocked ? 'Session is locked by AI Proctoring or security settings.' : 'Prerequisites missing (Face registration required).',
      updatedAt: new Date().toISOString(),
      metadata: { attemptedQuestions, totalQuestions, isLocked, isDraft }
    };
  } else if (isDraft || pendingManualReview) {
    return {
      status: 'Unresolved',
      reason: isDraft ? 'Attempt is currently saved as draft.' : 'Attempt is pending manual review.',
      updatedAt: new Date().toISOString(),
      metadata: { attemptedQuestions, totalQuestions, isLocked, isDraft }
    };
  } else if (attemptedQuestions < totalQuestions) {
    return {
      status: 'Partial',
      reason: `Attempted ${attemptedQuestions}/${totalQuestions} questions.`,
      updatedAt: new Date().toISOString(),
      metadata: { attemptedQuestions, totalQuestions, isLocked, isDraft }
    };
  } else {
    return {
      status: 'Complete',
      reason: 'All questions attempted and submitted.',
      updatedAt: new Date().toISOString(),
      metadata: { attemptedQuestions, totalQuestions, isLocked, isDraft }
    };
  }
}

// In-memory active exam paper store & broadcast delivery receipts
let activeExamPaper = null;
let broadcastReceipts = new Map();

// In-memory OTP store (email -> { otp, expires })
const otps = new Map();

// Configure SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// REST API Endpoints

// Generate and send OTP
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes expiration
  otps.set(email.toLowerCase(), { otp, expires });

  console.log(`[OTP] Generated for ${email}: ${otp}`);

  // Send real email if SMTP configured, otherwise send simulated
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: `"SAMADHAN X Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'SAMADHAN X - Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}. It is valid for 5 minutes.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 500px;">
            <h2 style="color: #745843;">SAMADHAN X Password Reset</h2>
            <p>You requested a password reset. Use the following 6-digit One-Time Password (OTP) to complete the request:</p>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 6px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #0f172a; margin: 20px 0;">
              ${otp}
            </div>
            <p style="font-size: 12px; color: #64748b;">This OTP is valid for 5 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      });
      return res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (error) {
      console.error('Failed to send real email:', error);
      return res.json({ 
        success: true, 
        simulated: true, 
        otp, 
        message: 'SMTP Error: Showing simulated OTP in the browser console and UI.' 
      });
    }
  } else {
    return res.json({ 
      success: true, 
      simulated: true, 
      otp, 
      message: 'SMTP config missing in .env. Showing simulated OTP for testing.' 
    });
  }
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const record = otps.get(email.toLowerCase());
  if (!record) {
    return res.status(400).json({ error: 'No OTP requested for this email' });
  }

  if (Date.now() > record.expires) {
    otps.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  otps.delete(email.toLowerCase());
  res.json({ success: true, message: 'OTP verified successfully' });
});

app.get('/api/active-center', (req, res) => {
  res.json({ activeCenterId });
});

app.post('/api/active-center', (req, res) => {
  const { centerId } = req.body;
  if (centerId === undefined) {
    return res.status(400).json({ error: 'centerId is required' });
  }
  activeCenterId = parseInt(centerId);
  io.emit('active_center_changed', activeCenterId);
  console.log(`Active center changed to: ${activeCenterId}`);
  res.json({ success: true, activeCenterId });
});

app.get('/api/students', (req, res) => {
  res.json(students);
});

app.post('/api/students', (req, res) => {
  const { name, roll, seat } = req.body;
  if (!name || !roll || !seat) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const totalQuestions = activeExamPaper && activeExamPaper.questions ? activeExamPaper.questions.length : 5;
  const newStudent = {
    id: nextId++,
    name,
    roll,
    seat,
    centerId: activeCenterId,
    status: 'pending',
    match: Math.floor(Math.random() * 20) + 80, // Random match between 80-100 for mock purposes
    intent: 'UNRESOLVED',
    intentStatus: calculateCompletionSignal({
      attemptedQuestions: 0,
      totalQuestions,
      isLocked: true,
      isDraft: false,
      prerequisitesMissing: true,
      pendingManualReview: false
    })
  };

  students.push(newStudent);
  
  // Emit to all connected clients
  io.emit('student_added', newStudent);
  
  res.status(201).json(newStudent);
});

app.put('/api/students/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  
  const student = students.find(s => s.id === id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  student.status = status;
  
  const totalQuestions = activeExamPaper && activeExamPaper.questions ? activeExamPaper.questions.length : 5;
  const attemptedQuestions = student.answers ? 
    (Array.isArray(student.answers) ? student.answers.filter(Boolean).length : Object.keys(student.answers).length) : 0;

  student.intentStatus = calculateCompletionSignal({
    attemptedQuestions,
    totalQuestions,
    isLocked: student.status === 'pending' || !student.referenceDescriptor,
    isDraft: student.status !== 'submitted',
    prerequisitesMissing: !student.referenceDescriptor,
    pendingManualReview: student.status === 'flagged'
  });
  
  // Keep intent property in sync
  student.intent = student.intentStatus.status.toUpperCase();

  // Emit update
  io.emit('student_updated', student);
  
  res.json(student);
});

app.put('/api/students/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const studentIndex = students.findIndex(s => s.id === id);
  if (studentIndex === -1) {
    return res.status(404).json({ error: 'Student not found' });
  }

  students[studentIndex] = { ...students[studentIndex], ...req.body };
  const student = students[studentIndex];

  const totalQuestions = req.body.totalQuestions !== undefined ? req.body.totalQuestions : (
    activeExamPaper && activeExamPaper.questions ? activeExamPaper.questions.length : 5
  );
  const attemptedQuestions = req.body.attemptedQuestions !== undefined ? req.body.attemptedQuestions : (
    student.answers ? (Array.isArray(student.answers) ? student.answers.filter(Boolean).length : Object.keys(student.answers).length) : 0
  );
  
  const isLocked = req.body.isLocked !== undefined ? req.body.isLocked : (student.status === 'pending' || !student.referenceDescriptor);
  const isDraft = req.body.isDraft !== undefined ? req.body.isDraft : (student.status !== 'submitted');

  student.intentStatus = calculateCompletionSignal({
    attemptedQuestions,
    totalQuestions,
    isLocked,
    isDraft,
    prerequisitesMissing: !student.referenceDescriptor,
    pendingManualReview: student.status === 'flagged'
  });

  student.intent = student.intentStatus.status.toUpperCase();
  
  io.emit('student_updated', student);
  res.json(student);
});

app.put('/api/students/roll/:roll', (req, res) => {
  const roll = req.params.roll;
  const studentIndex = students.findIndex(s => s.roll.toLowerCase() === roll.toLowerCase());
  if (studentIndex === -1) {
    return res.status(404).json({ error: 'Student not found' });
  }

  students[studentIndex] = { ...students[studentIndex], ...req.body };
  const student = students[studentIndex];

  const totalQuestions = req.body.totalQuestions !== undefined ? req.body.totalQuestions : (
    activeExamPaper && activeExamPaper.questions ? activeExamPaper.questions.length : 5
  );
  const attemptedQuestions = req.body.attemptedQuestions !== undefined ? req.body.attemptedQuestions : (
    student.answers ? (Array.isArray(student.answers) ? student.answers.filter(Boolean).length : Object.keys(student.answers).length) : 0
  );
  
  const isLocked = req.body.isLocked !== undefined ? req.body.isLocked : (student.status === 'pending' || !student.referenceDescriptor);
  const isDraft = req.body.isDraft !== undefined ? req.body.isDraft : (student.status !== 'submitted');

  student.intentStatus = calculateCompletionSignal({
    attemptedQuestions,
    totalQuestions,
    isLocked,
    isDraft,
    prerequisitesMissing: !student.referenceDescriptor,
    pendingManualReview: student.status === 'flagged'
  });

  student.intent = student.intentStatus.status.toUpperCase();

  io.emit('student_updated', student);
  res.json(student);
});

app.delete('/api/students/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = students.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Student not found' });
  }
  const deletedStudent = students.splice(index, 1)[0];
  io.emit('student_deleted', deletedStudent);
  res.json({ success: true, deletedStudent });
});

app.post('/api/cheat', (req, res) => {
  const { name, message } = req.body;
  
  // Find roll number assigned by invigilator based on the name (case-insensitive)
  const student = students.find(s => s.name.toLowerCase() === (name || '').toLowerCase());
  const roll = student ? student.roll : 'Unassigned';

  console.log(`Cheating attempt by ${name || 'Unknown'} (${roll}): ${message}`);
  
  const alertData = {
    id: Date.now(),
    roll: roll,
    name: name || 'Unknown Student',
    message: message || 'Cheating detected',
    timestamp: new Date().toISOString()
  };
  
  io.emit('cheating_attempt', alertData);
  res.json({ success: true });
});

// Exam Paper Broadcast Endpoints
app.get('/api/active-exam-paper', (req, res) => {
  if (activeExamPaper && activeExamPaper.startTime) {
    const elapsed = Math.floor((Date.now() - activeExamPaper.startTime) / 1000);
    const duration = activeExamPaper.durationSeconds || 10800; // 3 hours
    const remainingSeconds = Math.max(0, duration - elapsed);
    return res.json({ ...activeExamPaper, remainingSeconds });
  }
  res.json(null);
});

app.get('/api/broadcast-stats', (req, res) => {
  const deliveredList = Array.from(broadcastReceipts.values());
  res.json({
    deliveredCount: deliveredList.length,
    deliveredStudents: deliveredList
  });
});

app.post('/api/publish-exam-paper', (req, res) => {
  const { title, subject, pdfDataUrl, questions, durationSeconds, answerKey } = req.body;
  if (!title || !pdfDataUrl) {
    return res.status(400).json({ error: 'Title and PDF document are required' });
  }

  broadcastReceipts.clear();

  const duration = durationSeconds || 10800; // 3 hours (10,800 seconds)
  activeExamPaper = {
    id: Date.now(),
    title: title || 'Advanced Examination Paper',
    subject: subject || 'General Examination',
    pdfDataUrl,
    questions: questions || [],
    answerKey: answerKey || [], // Array of strings e.g. ['A', 'B', 'C']
    startTime: Date.now(),
    durationSeconds: duration
  };

  const remainingSeconds = duration;
  const broadcastData = { ...activeExamPaper, remainingSeconds };

  console.log(`[EXAM BROADCAST] Published paper "${title}" with 3-hour timer.`);
  io.emit('exam_paper_published', broadcastData);
  io.emit('broadcast_stats_updated', { deliveredCount: 0, deliveredStudents: [] });

  res.json({ success: true, activeExamPaper: broadcastData });
});

app.post('/api/reset-exam-paper', (req, res) => {
  activeExamPaper = null;
  broadcastReceipts.clear();
  io.emit('exam_paper_reset');
  io.emit('broadcast_stats_updated', { deliveredCount: 0, deliveredStudents: [] });
  console.log(`[EXAM BROADCAST] Exam paper reset.`);
  res.json({ success: true });
});

app.post('/api/submit-exam', (req, res) => {
  const { roll, answers } = req.body;
  if (!roll) {
    return res.status(400).json({ error: 'Roll number is required' });
  }

  const student = students.find(s => s.roll.toLowerCase() === roll.toLowerCase());
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  let score = 0;
  const maxScore = activeExamPaper && activeExamPaper.answerKey ? activeExamPaper.answerKey.length : 0;
  
  if (activeExamPaper && activeExamPaper.answerKey && activeExamPaper.answerKey.length > 0 && answers) {
    for (let i = 0; i < maxScore; i++) {
      if (answers[i] === activeExamPaper.answerKey[i]) {
        score++;
      }
    }
  }

  student.status = 'submitted';
  student.score = score;
  student.maxScore = maxScore;
  student.answers = answers;
  student.intent = 'COMPLETE';

  // Calculate and attach intentStatus
  const totalQuestions = maxScore || (activeExamPaper && activeExamPaper.questions ? activeExamPaper.questions.length : 5);
  const attemptedQuestions = answers ? answers.filter(Boolean).length : totalQuestions;

  student.intentStatus = calculateCompletionSignal({
    attemptedQuestions,
    totalQuestions,
    isLocked: false,
    isDraft: false,
    prerequisitesMissing: false,
    pendingManualReview: false
  });

  console.log(`[EXAM SUBMITTED] ${student.name} (${roll}) Score: ${score}/${maxScore}`);
  io.emit('student_updated', student);
  
  res.json({ success: true, score, maxScore });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  
  if (activeExamPaper && activeExamPaper.startTime) {
    const elapsed = Math.floor((Date.now() - activeExamPaper.startTime) / 1000);
    const remainingSeconds = Math.max(0, (activeExamPaper.durationSeconds || 10800) - elapsed);
    socket.emit('exam_paper_published', { ...activeExamPaper, remainingSeconds });
  }

  // Send current broadcast stats upon connection
  const initialDelivered = Array.from(broadcastReceipts.values());
  socket.emit('broadcast_stats_updated', { deliveredCount: initialDelivered.length, deliveredStudents: initialDelivered });

  // Handle PDF received acknowledgment from students
  socket.on('paper_received_ack', (data) => {
    if (!data || !data.roll) return;
    const studentKey = (data.roll || socket.id).toString().toLowerCase();
    const record = {
      socketId: socket.id,
      roll: data.roll,
      name: data.name || 'Student',
      time: new Date().toLocaleTimeString()
    };
    broadcastReceipts.set(studentKey, record);
    const updatedList = Array.from(broadcastReceipts.values());
    console.log(`[PDF ACK] PDF delivered to ${record.name} (${record.roll}). Total delivered: ${updatedList.length}`);
    io.emit('broadcast_stats_updated', { deliveredCount: updatedList.length, deliveredStudents: updatedList });
  });

  // Handle student intent updates (Round 2 Feature)
  socket.on('student_intent_update', (data) => {
    if (!data || !data.roll) return;
    console.log(`[INTENT] ${data.name} (${data.roll}) updated status to: ${data.intent}`);
    
    // Update student intent in the local in-memory DB and compute intentStatus
    const student = students.find(s => s.roll.toLowerCase() === data.roll.toLowerCase());
    if (student) {
      student.intent = data.intent;
      
      const totalQuestions = activeExamPaper && activeExamPaper.questions ? activeExamPaper.questions.length : 5;
      const attemptedQuestions = student.answers ? 
        (Array.isArray(student.answers) ? student.answers.filter(Boolean).length : Object.keys(student.answers).length) : 0;
      
      const manualBlocked = data.intent === 'BLOCKED';
      const manualDraft = data.intent === 'UNRESOLVED' || data.intent === 'PARTIAL';
      const manualComplete = data.intent === 'COMPLETE';

      student.intentStatus = calculateCompletionSignal({
        attemptedQuestions,
        totalQuestions,
        isLocked: manualBlocked || student.status === 'pending' || !student.referenceDescriptor,
        isDraft: manualDraft || (student.status !== 'submitted' && !manualComplete),
        prerequisitesMissing: !student.referenceDescriptor,
        pendingManualReview: student.status === 'flagged'
      });
      
      io.emit('student_updated', student);
    }
    
    io.emit('student_intent_updated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SAMADHAN X Backend Server running on port ${PORT}`);
});
