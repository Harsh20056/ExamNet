import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle, AlertCircle, Search, UserCheck, Plus, Trash2, Clock, Camera } from 'lucide-react';
import { io } from 'socket.io-client';
import CameraCaptureModal from '../components/CameraCaptureModal';
import ExamPaperBroadcaster from '../components/ExamPaperBroadcaster';
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
  score?: number;
  maxScore?: number;
  referenceDescriptor?: number[];
}

interface CheatingAlert {
  id: string | number;
  roll: string;
  name: string;
  message: string;
  timestamp: number;
}

const STATIC_CENTERS = [
  { id: 2, name: 'Mumbai Central - Block B', location: 'Mumbai', expected: 80, present: 45, verified: 40 },
  { id: 3, name: 'Delhi Tech Arena - Hall 1', location: 'New Delhi', expected: 90, present: 62, verified: 58 },
  { id: 4, name: 'Bangalore Cyberspace - Lab 3', location: 'Bengaluru', expected: 70, present: 31, verified: 28 },
  { id: 5, name: 'Chennai Network Hub', location: 'Chennai', expected: 80, present: 42, verified: 39 },
  { id: 6, name: 'Kolkata Exam Space - Block A', location: 'Kolkata', expected: 100, present: 54, verified: 50 },
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

export default function InvigilatorDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [activeCenterId, setActiveCenterId] = useState<number>(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', roll: '', seat: '' });
  const [cheatingAlerts, setCheatingAlerts] = useState<CheatingAlert[]>([]);
  const [capturingForStudent, setCapturingForStudent] = useState<Student | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://127.0.0.1:5000' : `https://zup-exam-backend-42.loca.lt`);

  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Fetch active center first
    fetch(`${BACKEND_URL}/api/active-center`)
      .then(res => res.json())
      .then(data => {
        if (data.activeCenterId) {
          setActiveCenterId(data.activeCenterId);
        }
      })
      .catch(err => console.error('Failed to fetch active center', err));

    fetch(`${BACKEND_URL}/api/students`)
      .then(res => res.json())
      .then(data => {
        setStudents(prev => {
          const map = new Map();
          prev.forEach(s => map.set(s.id, s));
          data.forEach((s: Student) => map.set(s.id, s));
          return Array.from(map.values());
        });
      })
      .catch(err => console.error('Failed to fetch students', err));

    const socketInstance = io(BACKEND_URL);
    setSocket(socketInstance);
    
    socketInstance.on('active_center_changed', (centerId: number) => {
      setActiveCenterId(centerId);
    });

    socketInstance.on('student_added', (student: Student) => {
      setStudents(prev => [...prev, student]);
    });

    socketInstance.on('student_updated', (updatedStudent: Student) => {
      setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    });

    socketInstance.on('cheating_attempt', (alert: CheatingAlert) => {
      setCheatingAlerts(prev => [alert, ...prev].slice(0, 5)); // Keep latest 5 alerts
      // Automatically flag the student if they exist
      setStudents(prev => prev.map(s => s.roll === alert.roll ? { ...s, status: 'flagged' } : s));
    });

    socketInstance.on('student_intent_updated', (data: {roll: string, intent: string}) => {
      setStudents(prev => prev.map(s => s.roll === data.roll ? { ...s, intent: data.intent } : s));
    });

    socketInstance.on('student_deleted', (deletedStudent: Student) => {
      setStudents(prev => prev.filter(s => s.id !== deletedStudent.id));
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.roll || !newStudent.seat) return;

    if (students.some(s => s.roll.toLowerCase() === newStudent.roll.trim().toLowerCase())) {
      alert(`Warning: Roll Number "${newStudent.roll}" already exists!`);
      return;
    }
    if (students.some(s => s.seat.toLowerCase() === newStudent.seat.trim().toLowerCase())) {
      alert(`Warning: Seat "${newStudent.seat}" is already assigned!`);
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent)
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      setShowAddModal(false);
      setNewStudent({ name: '', roll: '', seat: '' });
    } catch(err) {
      console.error(err);
      alert("Failed to add entry. Please make sure the backend server is running.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleCaptureFace = async (descriptor: number[]) => {
    if (!capturingForStudent) return;
    
    // Check for duplicate face
    const euclideanDistance = (a: number[], b: number[]) => Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
    
    const duplicateStudent = students.find(s => {
      if (!s.referenceDescriptor || s.id === capturingForStudent.id) return false;
      return euclideanDistance(descriptor, s.referenceDescriptor) < 0.55;
    });

    if (duplicateStudent) {
      alert(`Warning: This face is already registered to ${duplicateStudent.name} (Roll: ${duplicateStudent.roll}). Duplicate faces are not allowed!`);
      setCapturingForStudent(null);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/students/${capturingForStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceDescriptor: descriptor, status: 'verified' })
      });
      if (!response.ok) throw new Error('Failed to save face');
    } catch (err) {
      console.error(err);
      // Fallback for UI
      setStudents(prev => prev.map(s => s.id === capturingForStudent.id ? { ...s, referenceDescriptor: descriptor, status: 'verified' } : s));
    }
    setCapturingForStudent(null);
  };

  const handleDeleteStudent = async (studentId: number) => {
    setStudents(prev => prev.filter(s => s.id !== studentId));
    try {
      await fetch(`${BACKEND_URL}/api/students/${studentId}`, {
        method: 'DELETE'
      });
    } catch(err) {
      console.error('Backend offline, deleted locally', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={18} />;
      case 'pending': return <UserCheck className="text-slate-400 dark:text-slate-500" size={18} />;
      case 'flagged': return <AlertCircle className="text-red-500 dark:text-red-400" size={18} />;
      default: return null;
    }
  };

  const activeStudents = React.useMemo(() => {
    const backendStudentsForCenter = students.filter(s => (s.centerId || 1) === activeCenterId);
    if (activeCenterId === 1) return backendStudentsForCenter;
    const mockBase = generateMockStudentsForCenter(activeCenterId);
    return [...mockBase, ...backendStudentsForCenter];
  }, [activeCenterId, students]);

  const filteredStudents = activeStudents.filter(s => 
    s.roll.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const getActiveCenterStats = () => {
    if (activeCenterId === 1) {
      const backendStudents = students.filter(s => (s.centerId || 1) === 1);
      const present = backendStudents.length;
      const verified = backendStudents.filter(s => s.status === 'verified').length;
      const flagged = backendStudents.filter(s => s.status === 'flagged').length;
      return { expected: 80, present, verified, flagged };
    } else {
      const center = STATIC_CENTERS.find(c => c.id === activeCenterId);
      const backendStudents = students.filter(s => s.centerId === activeCenterId);
      const expected = center?.expected || 0;
      const present = (center?.present || 0) + backendStudents.length;
      const verified = (center?.verified || 0) + backendStudents.filter(s => s.status === 'verified').length;
      const flagged = backendStudents.filter(s => s.status === 'flagged').length;
      return { expected, present, verified, flagged };
    }
  };

  const { expected: activeExpected, present: presentCount, verified: verifiedCount, flagged: flaggedCount } = getActiveCenterStats();

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex justify-between items-end mb-8 border-b border-slate-200 dark:border-slate-800 pb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Invigilator Panel</h1>
          <p className="text-slate-650 dark:text-slate-400 flex items-center font-medium">
            <span>{activeCenterId === 1 ? 'Local Campus - Hall 3' : STATIC_CENTERS.find(c => c.id === activeCenterId)?.name}</span>
            <span className="mx-2">•</span>
            <span>Advanced Algorithms (Live Telemetry Focus)</span>
          </p>
        </div>
        <div className="text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm flex items-center space-x-4">
          <div className="bg-primary-50 dark:bg-primary-900/20 p-2 rounded-md">
            <Clock className="text-primary-600 dark:text-primary-400" size={24} />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Time Remaining</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">02:14:00</div>
          </div>
        </div>
      </header>

      {cheatingAlerts.length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center">
            <AlertCircle className="mr-2" size={20} /> Action Required: Recent Alerts
          </h2>
          <AnimatePresence>
            {cheatingAlerts.map(alert => (
              <motion.div 
                key={alert.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 p-4 rounded-xl flex items-start justify-between shadow-sm"
              >
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-300 text-sm mb-1">Roll: {alert.roll} ({alert.name})</p>
                  <p className="text-red-600 dark:text-red-400 text-sm">{alert.message}</p>
                </div>
                <div className="text-xs font-medium text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Invigilator Question Paper Broadcast & 3-Hour Timer */}
      <ExamPaperBroadcaster socket={socket} backendUrl={BACKEND_URL} totalExpected={activeExpected} presentCount={presentCount} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-6 flex items-center space-x-4">
          <div className="bg-primary-50 dark:bg-primary-900/20 p-3.5 rounded-lg text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/30">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{presentCount}<span className="text-lg text-slate-400 font-normal">/{activeExpected}</span></div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Present</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-6 flex items-center space-x-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3.5 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
            <CheckCircle size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{verifiedCount}</div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Verified</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-6 flex items-center space-x-4">
          <div className="bg-red-50 dark:bg-red-900/20 p-3.5 rounded-lg text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30">
            <AlertCircle size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{flaggedCount}</div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Flagged</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold flex items-center text-slate-900 dark:text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            Live Verification Feed
          </h2>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search roll no..." 
                className="pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={() => setShowAddModal(true)} className="btn-primary py-2 px-4 text-sm whitespace-nowrap">
              <Plus size={16} className="mr-1.5 inline" /> Add Entry
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 pl-6">Roll No</th>
                <th className="p-4">Student Name</th>
                <th className="p-4">Seat</th>
                <th className="p-4">AI Match</th>
                <th className="p-4">Intent</th>
                <th className="p-4">Status</th>
                <th className="p-4">Score</th>
                <th className="p-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.map((student) => (
                  <motion.tr 
                    key={student.id} 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">{student.roll}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">{student.name}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-sm">{student.seat}</td>
                    <td className="p-4">
                      {student.referenceDescriptor ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/30 dark:text-emerald-400">
                          <CheckCircle size={12} className="mr-1" /> Face Saved
                        </span>
                      ) : (
                        <button 
                          onClick={() => setCapturingForStudent(student)} 
                          className="flex items-center p-1.5 px-3 bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 rounded-md border border-primary-200 dark:border-primary-800/30 transition-colors shadow-sm" 
                          title="Capture Reference Face"
                        >
                          <Camera size={14} className="mr-1.5" /> <span className="text-xs font-medium">Capture</span>
                        </button>
                      )}
                    </td>
                    <td className="p-4">
                      <IntentStatusBadge intentStatus={student.intentStatus} fallbackStatus={student.intent} />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(student.status)}
                        <span className="capitalize text-sm font-medium text-slate-700 dark:text-slate-300">{student.status}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {student.status === 'submitted' ? (
                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded text-xs border border-indigo-200 dark:border-indigo-800">
                          {student.score} / {student.maxScore}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-white dark:bg-slate-900 shadow-sm"
                          title="Delete Entry"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex flex-col items-center justify-center">
                      <Search size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="font-medium text-slate-600 dark:text-slate-400">No records found</p>
                      <p className="text-sm mt-1 text-slate-500">Add a new entry to see it here live.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white tracking-tight">Add Manual Entry</h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Student Name</label>
                <input required type="text" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Roll Number</label>
                <input required type="text" value={newStudent.roll} onChange={e => setNewStudent({...newStudent, roll: e.target.value})} className="input-field" placeholder="CS-2026-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Assigned Seat</label>
                <input required type="text" value={newStudent.seat} onChange={e => setNewStudent({...newStudent, seat: e.target.value})} className="input-field" placeholder="A-12" />
              </div>
              <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={isAdding} className="btn-primary text-sm px-6 disabled:opacity-50 flex items-center">
                  {isAdding ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> : null}
                  Save Entry
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {capturingForStudent && (
        <CameraCaptureModal 
          studentName={capturingForStudent.name}
          onClose={() => setCapturingForStudent(null)}
          onCapture={handleCaptureFace}
        />
      )}


    </div>
  );
}
