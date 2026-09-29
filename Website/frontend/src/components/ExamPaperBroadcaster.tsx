import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileUp, Radio, Clock, Eye, Trash2, CheckCircle2, FileText, Sparkles, Users, UserCheck } from 'lucide-react';
import { generateQuestionPaperPDF, compressImageDataUrl } from '../utils/pdfGenerator';
import toast from 'react-hot-toast';

interface ActiveExamPaper {
  id: number;
  title: string;
  subject: string;
  pdfDataUrl: string;
  startTime: number;
  durationSeconds: number;
  remainingSeconds?: number;
}

interface ExamPaperBroadcasterProps {
  socket: any;
  backendUrl: string;
  totalExpected?: number;
  presentCount?: number;
}

export default function ExamPaperBroadcaster({ socket, backendUrl, totalExpected, presentCount }: ExamPaperBroadcasterProps) {
  const [activePaper, setActivePaper] = useState<ActiveExamPaper | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  const [deliveredCount, setDeliveredCount] = useState<number>(0);
  const [deliveredStudents, setDeliveredStudents] = useState<any[]>([]);

  // Form states
  const [title, setTitle] = useState('Advanced Algorithms Final Exam');
  const [subject, setSubject] = useState('Computer Science');
  const [instructions, setInstructions] = useState('1. All questions are compulsory.\n2. 3-Hour timer is live upon broadcast.\n3. Do not attempt to exit fullscreen mode.');
  const [rawContent, setRawContent] = useState('');
  const [answerKeyInput, setAnswerKeyInput] = useState('A,B,C,D');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');

  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | null>(null);

  // Fetch initial active paper and broadcast delivery stats on mount
  useEffect(() => {
    fetch(`${backendUrl}/api/active-exam-paper`)
      .then(res => res.json())
      .then(data => {
        if (data && data.startTime) {
          setActivePaper(data);
        }
      })
      .catch(err => console.error('Failed to fetch active paper', err));

    fetch(`${backendUrl}/api/broadcast-stats`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setDeliveredCount(data.deliveredCount || 0);
          setDeliveredStudents(data.deliveredStudents || []);
        }
      })
      .catch(err => console.error('Failed to fetch broadcast stats', err));

    if (socket) {
      socket.on('exam_paper_published', (paper: ActiveExamPaper) => {
        setActivePaper(paper);
        toast.success(`Exam Paper "${paper.title}" Broadcasted to All Students!`);
      });

      socket.on('exam_paper_reset', () => {
        setActivePaper(null);
        setTimeLeft(null);
        setDeliveredCount(0);
        setDeliveredStudents([]);
        toast.error('Exam broadcast reset by invigilator');
      });

      socket.on('broadcast_stats_updated', (data: { deliveredCount: number; deliveredStudents: any[] }) => {
        setDeliveredCount(data.deliveredCount || 0);
        setDeliveredStudents(data.deliveredStudents || []);
      });
    }

    return () => {
      if (socket) {
        socket.off('exam_paper_published');
        socket.off('exam_paper_reset');
        socket.off('broadcast_stats_updated');
      }
    };
  }, [socket, backendUrl]);

  // Live timer tick
  useEffect(() => {
    if (!activePaper?.startTime) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - activePaper.startTime) / 1000);
      const duration = activePaper.durationSeconds || 10800; // 3 hours
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activePaper]);

  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null) return '03:00:00';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Automatic file conversion to PDF (Supports PDF, Photos/Images, TXT)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    setIsProcessing(true);

    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setPdfPreviewUrl(result);
        setUploadedImageDataUrl(null);
        setIsProcessing(false);
        toast.success('PDF file loaded successfully!');
      };
      reader.readAsDataURL(file);
    } else if (isImage) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawImgDataUrl = event.target?.result as string;
        // Compress image to ensure fast network broadcast and lightweight PDF payload
        const imgDataUrl = await compressImageDataUrl(rawImgDataUrl, 1200, 0.75);
        setUploadedImageDataUrl(imgDataUrl);

        // Convert photo image directly into formatted PDF with the photo embedded!
        const generatedPdf = generateQuestionPaperPDF({
          title: title || file.name.replace(/\.[^/.]+$/, ''),
          subject: subject || 'Examination Paper',
          instructions,
          imageDataUrl: imgDataUrl,
          rawText: rawContent.trim() ? rawContent : undefined
        });

        setPdfPreviewUrl(generatedPdf);
        setIsProcessing(false);
        toast.success('Photo of question paper converted to PDF successfully!');
      };
      reader.readAsDataURL(file);
    } else {
      // Text / DOCX / JSON file
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawContent(text || `Uploaded content from ${file.name}`);
        setUploadedImageDataUrl(null);
        
        const generatedPdf = generateQuestionPaperPDF({
          title: title || file.name.replace(/\.[^/.]+$/, ''),
          subject: subject || 'Examination Paper',
          instructions,
          rawText: text || `Uploaded File Content: ${file.name}`
        });

        setPdfPreviewUrl(generatedPdf);
        setIsProcessing(false);
        toast.success('File content converted to PDF successfully!');
      };
      reader.readAsText(file);
    }
  };

  const handleGeneratePdfFromForm = () => {
    setIsProcessing(true);

    const generatedPdf = generateQuestionPaperPDF({
      title,
      subject,
      instructions,
      imageDataUrl: uploadedImageDataUrl || undefined,
      rawText: rawContent.trim() ? rawContent : undefined
    });

    setPdfPreviewUrl(generatedPdf);
    setIsProcessing(false);
    toast.success('PDF preview updated!');
  };

  const handleBroadcast = async () => {
    let pdfToBroadcast = pdfPreviewUrl;

    if (!pdfToBroadcast) {
      pdfToBroadcast = generateQuestionPaperPDF({
        title,
        subject,
        instructions,
        imageDataUrl: uploadedImageDataUrl || undefined,
        rawText: rawContent || "1. Solve all questions as shown in the question paper."
      });
    }

    try {
      setIsProcessing(true);
      
      const answerKey = answerKeyInput
        .split(',')
        .map(ans => ans.trim().toUpperCase())
        .filter(ans => ans.length === 1);

      const res = await fetch(`${backendUrl}/api/publish-exam-paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          pdfDataUrl: pdfToBroadcast,
          answerKey,
          durationSeconds: 10800 // 3 Hours
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Server returned error status ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setActivePaper(data.activeExamPaper);
        setShowUploadModal(false);
        toast.success('🚀 Question Paper Broadcasted to All Logged-in Students! 3-Hour Timer Started!');
      } else {
        toast.error('Failed to broadcast question paper.');
      }
    } catch (err: any) {
      console.error('Broadcast failed:', err);
      toast.error(`Broadcast Error: ${err.message || 'Network error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetExam = async () => {
    if (!window.confirm('Are you sure you want to stop and reset the live exam broadcast?')) return;
    try {
      await fetch(`${backendUrl}/api/reset-exam-paper`, { method: 'POST' });
      setActivePaper(null);
      setTimeLeft(null);
      toast.success('Exam broadcast reset');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8 relative overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
            <Radio className="animate-pulse" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Question Paper Broadcast & Live Timer
              {activePaper && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping"></span>
                  LIVE BROADCAST ACTIVE
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload any question paper format — automatically converts to PDF, broadcasts to all logged-in students & starts 3-hour timer.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {activePaper ? (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold transition-colors"
              >
                <Eye size={16} className="mr-2" /> View Broadcasted PDF
              </button>
              <button
                onClick={handleResetExam}
                className="flex items-center px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400 rounded-lg text-sm font-semibold transition-colors"
              >
                <Trash2 size={16} className="mr-2" /> Stop Exam
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md transition-colors text-sm"
            >
              <FileUp size={18} className="mr-2" /> Upload & Broadcast Question Paper
            </button>
          )}
        </div>
      </div>

      {/* Live Telemetry & Broadcast Summary Banner */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered Students */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Users size={22} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Enrolled</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {totalExpected || 80} <span className="text-xs text-slate-400 font-normal">Students</span>
            </div>
          </div>
        </div>

        {/* Present Students */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <UserCheck size={22} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Present Students</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {presentCount || 0} <span className="text-xs text-slate-400 font-normal">Present</span>
            </div>
          </div>
        </div>

        {/* PDF Broadcast Delivered Count */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">PDF Delivered</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                <span>{deliveredCount}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  ({presentCount && presentCount > 0 ? Math.round((deliveredCount / presentCount) * 100) : (activePaper ? 100 : 0)}%)
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowDeliveryModal(true)}
            className="text-[11px] font-bold px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 rounded transition-colors"
          >
            View List
          </button>
        </div>

        {/* 3-Hour Reverse Countdown Timer */}
        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between border border-slate-800 shadow-inner">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Clock size={22} className="animate-spin-slow" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">3-Hour Exam Timer</div>
              <div className="text-xl font-mono font-bold tracking-tight text-indigo-400">
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload & Convert Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8"
          >
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="text-indigo-500" size={20} />
                  Upload & Auto-Convert Question Paper to PDF
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a document file or type questions. It will be converted into an official PDF and broadcasted live to all students with a 3-hour countdown timer.
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Exam Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
                    placeholder="e.g. Advanced Algorithms Final Exam"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
                    placeholder="e.g. Computer Science & Engineering"
                  />
                </div>

                {/* File Upload zone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Upload File (PDF, TXT, DOCX, Image)
                  </label>
                  <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl p-4 text-center">
                    <input
                      type="file"
                      id="invigilator-paper-file"
                      className="hidden"
                      accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.json"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="invigilator-paper-file" className="cursor-pointer flex flex-col items-center">
                      <FileUp size={28} className="text-indigo-500 mb-2" />
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        {uploadFileName ? `Loaded: ${uploadFileName}` : 'Choose File to Auto-Convert to PDF'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">Supports PDF, TXT, DOCX, Images, JSON</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Exam Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Raw Question Text / Additional Content (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={rawContent}
                    onChange={e => setRawContent(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-xs focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono"
                    placeholder="Paste raw questions or extra content here..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Answer Key (Auto-Grading)
                  </label>
                  <input
                    type="text"
                    value={answerKeyInput}
                    onChange={e => setAnswerKeyInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-emerald-500 text-emerald-900 dark:text-emerald-400 font-mono"
                    placeholder="e.g. A, B, C, D, A, A"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Comma-separated answers. The number of answers determines the number of questions shown to the student.</p>
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePdfFromForm}
                  disabled={isProcessing}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} /> Generate PDF Preview
                </button>
              </div>

              {/* PDF Live Preview Window */}
              <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-950 p-3 h-[380px] relative">
                <div className="flex justify-between items-center text-xs text-slate-300 mb-2 px-1 font-mono">
                  <span>PDF Live Preview</span>
                  {pdfPreviewUrl && <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Auto-Converted PDF Ready</span>}
                </div>
                {pdfPreviewUrl ? (
                  <iframe
                    src={pdfPreviewUrl}
                    title="PDF Preview"
                    className="w-full h-full rounded-lg bg-white border-0"
                  />
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                    <FileText size={40} className="mb-2 text-slate-600 animate-pulse" />
                    <p className="text-xs font-medium text-slate-400">No PDF Generated Yet</p>
                    <p className="text-[11px] text-slate-600 mt-1">Upload a file or click "Generate PDF Preview" to prepare the broadcast paper.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end items-center space-x-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBroadcast}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center gap-2"
              >
                <Radio size={16} className="animate-pulse" />
                Convert & Broadcast to All Logged-in Students (Start 3-Hour Timer)
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* View Broadcasted PDF Preview Modal */}
      {showPreviewModal && activePaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <FileText className="text-indigo-500" size={18} />
                  {activePaper.title} (Broadcasted PDF)
                </h3>
                <p className="text-xs text-slate-500">Live Time Remaining: {formatTime(timeLeft)}</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold"
              >
                Close Window
              </button>
            </div>
            <div className="flex-grow bg-slate-900 p-2">
              <iframe
                src={activePaper.pdfDataUrl}
                title="Active Broadcasted PDF"
                className="w-full h-full rounded-lg bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* PDF Delivery List Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="text-emerald-500" size={20} />
                PDF Broadcast Delivery Status
              </h3>
              <button onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold">✕</button>
            </div>
            <div className="mb-4 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
              <span>Total Delivered: <strong className="text-slate-900 dark:text-white font-bold">{deliveredCount}</strong> student(s)</span>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                {presentCount && presentCount > 0 ? Math.round((deliveredCount / presentCount) * 100) : (activePaper ? 100 : 0)}% Success
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {deliveredStudents.map((s, idx) => (
                <div key={idx} className="p-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                    <p className="text-slate-500 font-mono">Roll: {s.roll}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-mono rounded text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                    Delivered at {s.time}
                  </span>
                </div>
              ))}
              {deliveredStudents.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No delivery acknowledgments received yet. Make sure students are logged in and paper is broadcasted.
                </div>
              )}
            </div>
            <div className="mt-5 text-right">
              <button onClick={() => setShowDeliveryModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold">Close</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
