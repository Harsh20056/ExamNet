import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Activity, 
  ShieldAlert, 
  MapPin, 
  CheckCircle, 
  Terminal, 
  Search,
  Globe,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import { io } from 'socket.io-client';
import IntentStatusBadge from '../components/IntentStatusBadge';

interface Student {
  id: number;
  name: string;
  roll: string;
  status: string;
  seat: string;
  match: number | null;
  centerId?: number;
  intent?: string;
  intentStatus?: any;
}

interface CheatingAlert {
  id: string | number;
  roll: string;
  name: string;
  message: string;
  timestamp: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

const STATIC_CENTERS = [
  { id: 2, name: 'Mumbai Central - Block B', location: 'Mumbai', expected: 80, present: 45, verified: 40, status: 'Active' },
  { id: 3, name: 'Delhi Tech Arena - Hall 1', location: 'New Delhi', expected: 90, present: 62, verified: 58, status: 'Active' },
  { id: 4, name: 'Bangalore Cyberspace - Lab 3', location: 'Bengaluru', expected: 70, present: 31, verified: 28, status: 'Active' },
  { id: 5, name: 'Chennai Network Hub', location: 'Chennai', expected: 80, present: 42, verified: 39, status: 'Active' },
  { id: 6, name: 'Kolkata Exam Space - Block A', location: 'Kolkata', expected: 100, present: 54, verified: 50, status: 'Active' },
];

const generateMockStudentsForCenter = (centerId: number) => {
  const center = STATIC_CENTERS.find(c => c.id === centerId);
  if (!center) return [];
  const list: Student[] = [];
  const code = center.location.substring(0, 3).toUpperCase();
  const nameList = [
    'Amit Sharma', 'Priya Patel', 'Rajesh Kumar', 'Sneha Reddy', 'Vikram Singh',
    'Ananya Iyer', 'Sanjay Gupta', 'Deepika Rao', 'Arjun Mehta', 'Kriti Joshi',
    'Rahul Verma', 'Neha Nair', 'Aditya Mishra', 'Ritu Choudhary', 'Gaurav Sen',
    'Pooja Das', 'Sandeep Gill', 'Shreya Bose', 'Rohan Dixit', 'Tanvi Kapoor',
    'Abhishek Roy', 'Meera Krishnan', 'Jatin Solanki', 'Divya Saxena', 'Varun Joshi',
    'Nisha Prasad', 'Karan Khanna', 'Anjali Malhotra', 'Pranav Shah', 'Simran Kaur',
    'Manish Tiwari', 'Kavita Sharma', 'Rishabh Pant', 'Isha Ambani', 'Hardik Pandya',
    'Shikhar Dhawan', 'Rohit Sharma', 'Virat Kohli', 'Jasprit Bumrah', 'Kunal Pandya',
    'Yuzvendra Chahal', 'Ravindra Jadeja', 'Ajinkya Rahane', 'Cheteshwar Pujara', 'Ishant Sharma',
    'Mohammed Shami', 'Umesh Yadav', 'Bhuvneshwar Kumar', 'Shreyas Iyer', 'KL Rahul',
    'Sanju Samson', 'Ishan Kishan', 'Suryakumar Yadav', 'Deepak Chahar'
  ];
  for (let i = 1; i <= center.present; i++) {
    const isVerified = i <= center.verified;
    const name = nameList[(i - 1) % nameList.length];
    
    const intentStatus = (() => {
      if (!isVerified) {
        return {
          status: 'Blocked' as const,
          reason: 'Prerequisites missing (Face registration required).',
          updatedAt: new Date().toISOString(),
          metadata: { attemptedQuestions: 0, totalQuestions: 5, isLocked: true, isDraft: false }
        };
      }
      const rand = Math.random();
      if (rand < 0.6) {
        return {
          status: 'Complete' as const,
          reason: 'All questions attempted and submitted.',
          updatedAt: new Date().toISOString(),
          metadata: { attemptedQuestions: 5, totalQuestions: 5, isLocked: false, isDraft: false }
        };
      } else if (rand < 0.9) {
        const attempted = Math.floor(Math.random() * 4) + 1;
        return {
          status: 'Partial' as const,
          reason: `Attempted ${attempted}/5 questions.`,
          updatedAt: new Date().toISOString(),
          metadata: { attemptedQuestions: attempted, totalQuestions: 5, isLocked: false, isDraft: true }
        };
      } else {
        return {
          status: 'Unresolved' as const,
          reason: 'Attempt is currently saved as draft.',
          updatedAt: new Date().toISOString(),
          metadata: { attemptedQuestions: 0, totalQuestions: 5, isLocked: false, isDraft: true }
        };
      }
    })();

    list.push({
      id: centerId * 1000 + i,
      name,
      roll: `CS-2026-${code}-${String(i).padStart(3, '0')}`,
      seat: `${String.fromCharCode(65 + (i % 6))}-${10 + (i % 20)}`,
      status: isVerified ? 'verified' : 'pending',
      match: isVerified ? Math.floor(Math.random() * 15) + 85 : null,
      intent: intentStatus.status.toUpperCase(),
      intentStatus
    });
  }
  return list;
};

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [cheatingAlerts, setCheatingAlerts] = useState<CheatingAlert[]>([]);
  const [actionLogs, setActionLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCenterId, setActiveCenterId] = useState<number>(1);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://127.0.0.1:5000' : `https://zup-exam-backend-42.loca.lt`);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setActionLogs(prev => [newEntry, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  useEffect(() => {
    // Scroll terminal to top when logs change (since we append at top, or we can reverse it)
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [actionLogs]);

  useEffect(() => {
    addLog('System Command Center initialized.', 'info');
    addLog('Connecting to backend socket server...', 'info');

    // Fetch initial students
    fetch(`${BACKEND_URL}/api/students`)
      .then(res => res.json())
      .then(data => {
        setStudents(data);
        setLoading(false);
        addLog(`Loaded ${data.length} active student record(s) from Center 1.`, 'success');
        data.forEach((s: Student) => {
          if (s.status === 'verified') {
            addLog(`Face ID verified student: ${s.name} (${s.roll}) at Center 1`, 'success');
          } else {
            addLog(`Student admitted: ${s.name} (${s.roll}) at Center 1`, 'info');
          }
        });
      })
      .catch(err => {
        console.error('Failed to fetch students', err);
        setLoading(false);
        addLog('Failed to fetch initial database from backend. Server offline.', 'error');
      });

    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      setConnected(true);
      addLog('WebSocket server connection established. Listening to live telemetry...', 'success');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addLog('WebSocket server disconnected. Retrying...', 'error');
    });

    socket.on('student_added', (student: Student) => {
      setStudents(prev => {
        if (prev.some(s => s.id === student.id)) return prev;
        return [...prev, student];
      });
      addLog(`[LIVE ENTRY] Student Present: ${student.name} (Roll: ${student.roll}) assigned to Seat ${student.seat} at Center 1.`, 'info');
    });

    socket.on('student_updated', (updatedStudent: Student) => {
      setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
      if (updatedStudent.status === 'verified') {
        addLog(`[LIVE FACE ID] Verification Successful: ${updatedStudent.name} (Roll: ${updatedStudent.roll}) verified at Center 1.`, 'success');
      } else if (updatedStudent.status === 'flagged') {
        addLog(`[LIVE PROCTOR] Security Flag Raised: ${updatedStudent.name} (Roll: ${updatedStudent.roll}) flagged for cheating at Center 1.`, 'error');
      } else {
        addLog(`[LIVE UPDATE] Student updated: ${updatedStudent.name} (Roll: ${updatedStudent.roll}) at Center 1.`, 'info');
      }
    });

    socket.on('student_deleted', (deletedStudent: Student) => {
      setStudents(prev => prev.filter(s => s.id !== deletedStudent.id));
      addLog(`[LIVE ENTRY] Entry Removed: Student ${deletedStudent.name} (Roll: ${deletedStudent.roll}) removed from Center 1.`, 'warning');
    });

    socket.on('cheating_attempt', (alert: CheatingAlert) => {
      setCheatingAlerts(prev => [alert, ...prev].slice(0, 10));
      addLog(`[ANOMALY ALERT] ${alert.name} (Roll: ${alert.roll}): ${alert.message}`, 'error');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Dynamically calculate stats for any center
  const getCenterStats = React.useCallback((centerId: number) => {
    if (centerId === 1) {
      const backendStudents = students.filter(s => (s.centerId || 1) === 1);
      return {
        expected: 80,
        present: backendStudents.length,
        verified: backendStudents.filter(s => s.status === 'verified').length
      };
    } else {
      const center = STATIC_CENTERS.find(c => c.id === centerId);
      const backendStudents = students.filter(s => s.centerId === centerId);
      return {
        expected: center?.expected || 0,
        present: (center?.present || 0) + backendStudents.length,
        verified: (center?.verified || 0) + backendStudents.filter(s => s.status === 'verified').length
      };
    }
  }, [students]);

  // Center 1 (Live Center) Data
  const center1Stats = getCenterStats(1);
  const liveExpected = center1Stats.expected;
  const livePresent = center1Stats.present;
  const liveVerified = center1Stats.verified;

  // Aggregate stats across all 6 centers
  const totalCenters = 6;
  const totalExpected = 500; // 80 (live) + 80 + 90 + 70 + 80 + 100 = 500
  
  const totalPresent = React.useMemo(() => {
    const c1 = getCenterStats(1).present;
    const others = STATIC_CENTERS.reduce((acc, c) => acc + getCenterStats(c.id).present, 0);
    return c1 + others;
  }, [getCenterStats]);

  const totalVerified = React.useMemo(() => {
    const c1 = getCenterStats(1).verified;
    const others = STATIC_CENTERS.reduce((acc, c) => acc + getCenterStats(c.id).verified, 0);
    return c1 + others;
  }, [getCenterStats]);

  // Percentages requested by user:
  // 1. Attendance percentage out of total expected students (500)
  const attendanceRate = totalExpected > 0 ? (totalPresent / totalExpected) * 100 : 0;
  // 2. Face verification percentage out of present students
  const verificationRate = totalPresent > 0 ? (totalVerified / totalPresent) * 100 : 0;

  // Get active students for directory based on activeCenterId selection
  const activeStudents = React.useMemo(() => {
    const backendStudentsForCenter = students.filter(s => (s.centerId || 1) === activeCenterId);
    if (activeCenterId === 1) return backendStudentsForCenter;
    const mockBase = generateMockStudentsForCenter(activeCenterId);
    return [...mockBase, ...backendStudentsForCenter];
  }, [activeCenterId, students]);

  const filteredLiveStudents = activeStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.roll.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleActivateCenter = async (centerId: number) => {
    setActiveCenterId(centerId);
    const centerName = centerId === 1 ? 'Center 1 (Live - Hall 3)' : STATIC_CENTERS.find(c => c.id === centerId)?.name;
    addLog(`Switched active command telemetry focus to ${centerName}.`, 'info');
    try {
      await fetch(`${BACKEND_URL}/api/active-center`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centerId })
      });
    } catch (err) {
      console.error('Failed to sync active center to backend:', err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 dark:text-slate-200">
      
      {/* Command Center Title Header */}
      <header className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Globe className="text-primary-600 dark:text-primary-400 animate-pulse" size={28} />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Global Command Center</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">High-level real-time overview of all 6 examination centres.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className={`w-2.5 h-2.5 rounded-full mr-2.5 ${connected ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></span>
            {connected ? 'Live Sync Active' : 'Disconnected'}
          </div>
        </div>
      </header>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Centers */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center space-x-4"
        >
          <div className="bg-primary-50 dark:bg-primary-900/20 p-3.5 rounded-lg text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/30">
            <MapPin size={24} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{totalCenters}</div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Centres</div>
          </div>
        </motion.div>

        {/* Total Students */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center space-x-4"
        >
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3.5 rounded-lg text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
            <Users size={24} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{totalExpected}</div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expected Students</div>
          </div>
        </motion.div>

        {/* Present Students */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center space-x-4"
        >
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3.5 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
            <Activity size={24} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{totalPresent}</div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Present Students</div>
          </div>
        </motion.div>

        {/* Face Verified */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center space-x-4"
        >
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3.5 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30">
            <CheckCircle size={24} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{totalVerified}</div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Face ID Verified</div>
          </div>
        </motion.div>
      </div>

      {/* Percentages Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Attendance Rate Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-950 dark:text-white flex items-center text-md">
              <Activity className="text-emerald-500 mr-2" size={18} />
              Overall Attendance Percentage
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">({totalPresent} / {totalExpected} Students)</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{attendanceRate.toFixed(1)}%</div>
            <div className="flex-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${attendanceRate}%` }}
                  transition={{ duration: 0.8 }}
                  className="bg-emerald-500 h-3 rounded-full"
                ></motion.div>
              </div>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-2 font-medium">Percentage of present students out of all registered candidates globally.</p>
            </div>
          </div>
        </motion.div>

        {/* Face Verification Rate Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-950 dark:text-white flex items-center text-md">
              <CheckCircle className="text-blue-500 mr-2" size={18} />
              Face ID Verification Percentage
            </h3>
            <span className="text-xs text-slate-550 dark:text-slate-400 font-medium">({totalVerified} / {totalPresent} Present)</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{verificationRate.toFixed(1)}%</div>
            <div className="flex-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${verificationRate}%` }}
                  transition={{ duration: 0.8 }}
                  className="bg-blue-500 h-3 rounded-full"
                ></motion.div>
              </div>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-2 font-medium">Percentage of face verified candidates out of the present candidates.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Centers List & Terminal logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Centres List & Live Student Table */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Centre Performance Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <Globe className="text-slate-400 mr-2" size={18} />
                Live Center Wise Registration Telemetry
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-4 pl-6">Centre Name</th>
                    <th className="p-4">Location</th>
                    <th className="p-4 text-center">Expected</th>
                    <th className="p-4 text-center">Present</th>
                    <th className="p-4 text-center">Face Verified</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                  
                  {/* Center 1 (LIVE) */}
                  <tr className={`hover:bg-primary-50/20 dark:hover:bg-primary-950/10 transition-colors font-semibold ${activeCenterId === 1 ? 'bg-primary-50/10 dark:bg-primary-900/10 border-l-4 border-l-primary-500' : ''}`}>
                    <td className="p-4 pl-6 flex items-center space-x-2">
                      {activeCenterId === 1 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1"></span>}
                      <span className="text-slate-900 dark:text-white">Center 1 (Live - Hall 3)</span>
                    </td>
                    <td className="p-4 text-slate-650 dark:text-slate-400 font-medium">Local Campus</td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400 font-mono">{liveExpected}</td>
                    <td className="p-4 text-center text-primary-650 dark:text-primary-400 font-mono">{livePresent}</td>
                    <td className="p-4 text-center text-emerald-650 dark:text-emerald-400 font-mono">{liveVerified}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleActivateCenter(1)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                          activeCenterId === 1 
                            ? 'bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:text-white dark:border-emerald-700 cursor-default shadow-sm font-bold' 
                            : 'bg-transparent text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
                        }`}
                      >
                        {activeCenterId === 1 ? 'LIVE' : 'ACTIVATE'}
                      </button>
                    </td>
                  </tr>

                  {/* Static Centers */}
                  {STATIC_CENTERS.map(center => {
                    const isActive = activeCenterId === center.id;
                    const stats = getCenterStats(center.id);
                    return (
                      <tr key={center.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isActive ? 'bg-primary-50/10 dark:bg-primary-900/10 border-l-4 border-l-primary-500 font-semibold' : ''}`}>
                        <td className="p-4 pl-6 flex items-center space-x-2">
                          {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1"></span>}
                          <span className="text-slate-850 dark:text-slate-300">{center.name}</span>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-450">{center.location}</td>
                        <td className="p-4 text-center text-slate-550 dark:text-slate-450 font-mono">{stats.expected}</td>
                        <td className="p-4 text-center text-slate-750 dark:text-slate-350 font-mono">{stats.present}</td>
                        <td className="p-4 text-center text-slate-750 dark:text-slate-350 font-mono">{stats.verified}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleActivateCenter(center.id)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                              isActive 
                                ? 'bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:text-white dark:border-emerald-700 cursor-default shadow-sm font-bold' 
                                : 'bg-transparent text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
                            }`}
                          >
                            {isActive ? 'LIVE' : 'ACTIVATE'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Students Directory for Active Center */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <FileSpreadsheet className="text-slate-400 mr-2" size={18} />
                {activeCenterId === 1 
                  ? 'Center 1 (Live - Hall 3) Admitted Students Directory' 
                  : `${STATIC_CENTERS.find(c => c.id === activeCenterId)?.name} Admitted Students Directory`
                }
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" size={15} />
                <input 
                  type="text" 
                  placeholder="Search live roll/name..." 
                  className="pl-9 pr-4 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-750 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 w-52 shadow-sm text-slate-900 dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {loading ? (
              <div className="p-12 flex justify-center items-center text-slate-500">
                <Loader2 className="animate-spin mr-3 text-primary-500" size={24} />
                <span>Loading active telemetry directory...</span>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-700 sticky top-0">
                    <tr>
                      <th className="p-3 pl-6">Roll No</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Seat</th>
                      <th className="p-3 text-center">Intent Status</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLiveStudents.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-sm">
                        <td className="p-3 pl-6 font-semibold text-slate-900 dark:text-white">{student.roll}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-350">{student.name}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-mono">{student.seat}</td>
                        <td className="p-3 text-center">
                          <IntentStatusBadge intentStatus={student.intentStatus} fallbackStatus={student.intent} />
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            student.status === 'verified' 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20' 
                              : student.status === 'flagged'
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20'
                              : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-450 border border-slate-205 dark:border-slate-700'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredLiveStudents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/10">
                          No live candidate records matching query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Live Security Anomaly Alerts & Activity Shell */}
        <div className="space-y-8">
          
          {/* Security alerts panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-red-650 dark:text-red-400 flex items-center mb-4">
              <ShieldAlert className="mr-2.5 animate-pulse" size={20} />
              Recent Proctoring Anomalies
            </h2>
            <div className="space-y-4 max-h-[22rem] overflow-y-auto pr-1">
              <AnimatePresence>
                {cheatingAlerts.map(alert => (
                  <motion.div 
                    key={alert.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-red-50/60 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 p-4 rounded-xl flex flex-col shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-red-800 dark:text-red-300 text-xs">Roll: {alert.roll} ({alert.name})</span>
                      <span className="text-[10px] text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-md font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-red-700 dark:text-red-400 text-xs leading-relaxed">{alert.message}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {cheatingAlerts.length === 0 && (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-850 rounded-xl text-slate-500 dark:text-slate-500 text-sm">
                  <CheckCircle className="mx-auto mb-2.5 text-emerald-500" size={24} />
                  No security alerts in this session. All centers clean.
                </div>
              )}
            </div>
          </div>

          {/* Activity terminal log */}
          <div className="bg-slate-950 border border-slate-850 rounded-2xl shadow-lg p-5 flex flex-col h-[28rem] text-slate-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Terminal size={14} className="text-primary-400" />
                <span>Live System Logs</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-[10px] font-mono text-slate-550">SHELL ACTIVE</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2 pr-1 select-text scrollbar-thin">
              {actionLogs.map((log) => (
                <div key={log.id} className="flex items-start">
                  <span className="text-slate-600 mr-2 select-none">[{log.timestamp}]</span>
                  <span className={`flex-1 ${
                    log.type === 'success' ? 'text-emerald-450 dark:text-emerald-400' :
                    log.type === 'warning' ? 'text-yellow-450 dark:text-yellow-450' :
                    log.type === 'error' ? 'text-red-405 dark:text-red-400 font-semibold' :
                    'text-slate-300'
                  }`}>
                    {log.type === 'error' ? '✗ ' : log.type === 'success' ? '✓ ' : '$ '}
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
