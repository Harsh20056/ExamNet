require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

// Import new foundation modules
const { initializeFirebaseAdmin } = require('./src/config/firebaseAdmin');
const { corsOptions, socketCorsOptions } = require('./src/config/cors');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const healthRouter = require('./src/routes/health');
const { initializeSocket, DashboardTicker } = require('./src/sockets');

// Initialize Firebase Admin (if configured)
try {
  initializeFirebaseAdmin();
} catch (error) {
  console.warn('[Server] Firebase Admin initialization skipped or failed. Auth routes will not work.');
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API server
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors(corsOptions));

// Rate limiting (general)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests', message: 'Please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);

// Initialize Socket.io with authentication
const io = initializeSocket(server, socketCorsOptions);

// Start dashboard ticker for real-time stats
const dashboardTicker = new DashboardTicker(io, 5000); // 5 second interval
dashboardTicker.start();

// Make io available to routes via middleware
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ========================================
// NEW ROUTES (with foundation)
// ========================================

// Health check (no auth required)
app.use('/api/health', healthRouter);

// Exam management routes (with auth + role-based access)
const examsRouter = require('./src/routes/exams');
app.use('/api/exams', examsRouter);

// Sheet management routes (with auth + role-based access)
const sheetsRouter = require('./src/routes/sheets');
app.use('/api/sheets', sheetsRouter);

// Alert management routes (with auth + role-based access)
const alertsRouter = require('./src/routes/alerts');
app.use('/api/alerts', alertsRouter);

// AI evaluation routes (with auth + role-based access)
const aiRouter = require('./src/routes/ai');
app.use('/api/ai', aiRouter);

// Moderation routes (with auth + role-based access)
const moderationRouter = require('./src/routes/moderation');
app.use('/api/moderation', moderationRouter);

// Identity verification routes (with auth + role-based access)
const identityRouter = require('./src/routes/identity');
app.use('/api/identity', identityRouter);

// Analytics routes (with auth + role-based access)
const analyticsRouter = require('./src/routes/analytics');
app.use('/api/analytics', analyticsRouter);

// Audit log routes (with auth + role-based access)
const auditRouter = require('./src/routes/audit');
app.use('/api/audit', auditRouter);

// Assignment routes (with auth + role-based access)
const assignmentRouter = require('./src/routes/assignment');
app.use('/api/sheets', assignmentRouter);

// Export routes (with auth + role-based access)
const exportRouter = require('./src/routes/export');
app.use('/api/export', exportRouter);

// ========================================
// EXISTING ROUTES (unchanged for now)
// ========================================

// In-memory active center store
let activeCenterId = 1;

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

// ========================================
// ERROR HANDLERS (must be last)
// ========================================
app.use(notFoundHandler);
app.use(errorHandler);

// ========================================
// Start Server
// ========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SAMADHAN X Backend Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
