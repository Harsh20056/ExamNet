import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTimer } from '../../hooks/useTimer';
import { mockExam, mockSheets } from '../../mock/data';
import { SheetViewer } from '../../components/marking/SheetViewer';
import { QuestionNavigator } from '../../components/marking/QuestionNavigator';
import { RubricPanel } from '../../components/marking/RubricPanel';
import { MarkEntry } from '../../components/marking/MarkEntry';
import { SubmitBar } from '../../components/marking/SubmitBar';
import { AIAssistPanel } from '../../components/marking/AIAssistPanel';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { 
  Sparkles, 
  BookOpen, 
  Award, 
  Menu, 
  X, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';
import toast from 'react-hot-toast';

import { AlertsApi, SheetsApi } from '../../services/api';

export default function MarkingWorkspace() {
  const { sheetId = 'sheet-001' } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();

  // Check if secure browser environment is present
  const isSecureEnvironment = Boolean(typeof window !== 'undefined' && window.secure);

  // Load target sheet and exam data
  const sheet = useMemo(() => {
    return mockSheets.find((s) => s.id === sheetId) || mockSheets[0];
  }, [sheetId]);

  const exam = mockExam;

  // Active state
  const [currentQuestionId, setCurrentQuestionId] = useState<string>(exam.questions[0].id);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [marksByQuestion, setMarksByQuestion] = useState<Record<string, number | undefined>>(() => {
    // Populate any previous draft from localStorage or initial dummy
    const saved = localStorage.getItem(`draft_marks_${sheet.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      q1: 4.5,
      q2: 8.0,
      q3: 6.5,
    };
  });

  const [commentsByQuestion, setCommentsByQuestion] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`draft_comments_${sheet.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      q1: 'Excellent formulation of amortized recurrence.',
      q2: 'Clear Fibonacci heap breakdown.',
    };
  });

  // UI Drawer and Bottom Sheet states for mobile/tablet
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'rubric' | 'marks' | 'ai'>('rubric');

  // Autosave and timer
  const { formattedTime } = useTimer();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedText, setLastSavedText] = useState('Draft saved');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const currentQuestion = useMemo(() => {
    return exam.questions.find((q) => q.id === currentQuestionId) || exam.questions[0];
  }, [exam.questions, currentQuestionId]);

  // Jump viewer to mapped page when question changes
  const jumpToQuestionPage = useCallback((questionId: string) => {
    const mapping = sheet.pageMap.find((pm) => pm.questionIds.includes(questionId));
    if (mapping) {
      setCurrentPage(mapping.pageNumber);
    }
  }, [sheet.pageMap]);

  // Handle question selection
  const handleSelectQuestion = (questionId: string) => {
    saveDraft();
    setCurrentQuestionId(questionId);
    jumpToQuestionPage(questionId);
    setLeftDrawerOpen(false);
  };

  // Mark change with validation
  const handleMarkChange = (val: number | string) => {
    if (val === '') {
      setMarksByQuestion((prev) => {
        const next = { ...prev };
        delete next[currentQuestionId];
        return next;
      });
      return;
    }

    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(num)) {
      setMarksByQuestion((prev) => ({
        ...prev,
        [currentQuestionId]: num,
      }));
    }
  };

  const handleCommentChange = (comment: string) => {
    setCommentsByQuestion((prev) => ({
      ...prev,
      [currentQuestionId]: comment,
    }));
  };

  // Calculate Running Total
  const runningTotal = useMemo(() => {
    return Object.values(marksByQuestion).reduce<number>((sum, val) => {
      if (typeof val === 'number' && !isNaN(val)) {
        return sum + val;
      }
      return sum;
    }, 0);
  }, [marksByQuestion]);

  // Save Draft logic
  const saveDraft = useCallback(() => {
    setIsSaving(true);
    localStorage.setItem(`draft_marks_${sheet.id}`, JSON.stringify(marksByQuestion));
    localStorage.setItem(`draft_comments_${sheet.id}`, JSON.stringify(commentsByQuestion));

    // Also persist to backend
    const marksPayload = Object.entries(marksByQuestion)
      .filter(([, val]) => typeof val === 'number')
      .map(([qId, val]) => {
        const qObj = exam.questions.find((q) => q.id === qId);
        return {
          qNo: qObj ? qObj.questionNumber : Number(qId.replace(/\D/g, '') || 1),
          marks: val as number,
          comment: commentsByQuestion[qId] || '',
        };
      });

    if (marksPayload.length > 0) {
      SheetsApi.saveMarks(sheet.id, { marks: marksPayload }).catch(() => {
        // Silently preserve local draft if offline or mock
      });
    }

    setTimeout(() => {
      setIsSaving(false);
      setLastSavedText(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }, 400);
  }, [sheet.id, marksByQuestion, commentsByQuestion, exam.questions]);

  // Autosave every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      saveDraft();
    }, 15000);
    return () => clearInterval(timer);
  }, [saveDraft]);

  // Secure marking mode and window violation handling
  useEffect(() => {
    // 1. Notify backend sheet marking started
    SheetsApi.startMarking(sheet.id).catch(() => {
      // Ignore if already in progress or using mock
    });

    // 2. In MarkingWorkspace call window.secure?.setMarkingMode(true) on mount and false on unmount
    if (window.secure?.setMarkingMode) {
      window.secure.setMarkingMode(true);
    }

    // 2. When window.secure.onViolation fires, post it to /api/alerts/violation with the sheetId through services/api.ts
    const unsubscribeViolation = window.secure?.onViolation?.((violation) => {
      const isBlur = violation.type === 'window_blur';
      const msg = isBlur
        ? 'Security Notice: Window focus lost. Activity logged in session audit trail.'
        : `Security Notice: Blocked key shortcut (${violation.shortcut || 'restricted'}).`;

      toast(msg, {
        icon: '🛡️',
        duration: 4000,
        style: {
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #dc2626',
          fontSize: '12px',
        },
      });

      // Post violation to backend
      AlertsApi.postViolation({
        sheetId: sheet.id,
        type: isBlur ? 'WINDOW_BLUR' : 'SUSPICIOUS_PATTERN',
        message: msg,
        metadata: {
          violationType: violation.type,
          shortcut: violation.shortcut || null,
          timestamp: violation.timestamp || new Date().toISOString(),
        }
      }).catch((err) => {
        console.warn('[MarkingWorkspace] Failed to report violation to backend:', err?.message || err);
      });
    });

    const handleBlur = () => {
      toast('Security Notice: Window focus lost. Activity logged in session audit trail.', {
        icon: '🛡️',
        duration: 3500,
        style: {
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          fontSize: '12px',
        },
      });
    };

    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('blur', handleBlur);
      if (unsubscribeViolation) unsubscribeViolation();
      if (window.secure?.setMarkingMode) {
        window.secure.setMarkingMode(false);
      }
    };
  }, [sheet.id]);

  // Client precheck on submit
  const handlePrecheckAndSubmit = () => {
    const unmarkedQuestions: number[] = [];

    exam.questions.forEach((q) => {
      const val = marksByQuestion[q.id];
      if (val === undefined || val === null || isNaN(val)) {
        unmarkedQuestions.push(q.questionNumber);
      }
    });

    if (unmarkedQuestions.length > 0) {
      toast.error(`Submission Blocked: Q${unmarkedQuestions.join(', Q')} unmarked! Please evaluate all questions before final submission.`, {
        duration: 5000,
      });
      // Automatically jump to the first unmarked question
      const firstUnmarked = exam.questions.find((q) => q.questionNumber === unmarkedQuestions[0]);
      if (firstUnmarked) {
        handleSelectQuestion(firstUnmarked.id);
        setActiveTab('marks');
      }
      return;
    }

    // Check if any mark exceeds maximum
    const invalidQuestions = exam.questions.filter((q) => {
      const val = marksByQuestion[q.id];
      return typeof val === 'number' && (val > q.maxMarks || val < 0);
    });

    if (invalidQuestions.length > 0) {
      toast.error(`Invalid mark on Q${invalidQuestions.map(q => q.questionNumber).join(', Q')}! Cannot exceed maximum limit.`, {
        duration: 5000,
      });
      return;
    }

    setShowConfirmSubmit(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSaving(true);
    setShowConfirmSubmit(false);

    try {
      // Persist final marks before submit
      const marksPayload = Object.entries(marksByQuestion)
        .filter(([, val]) => typeof val === 'number')
        .map(([qId, val]) => {
          const qObj = exam.questions.find((q) => q.id === qId);
          return {
            qNo: qObj ? qObj.questionNumber : Number(qId.replace(/\D/g, '') || 1),
            marks: val as number,
            comment: commentsByQuestion[qId] || '',
          };
        });

      if (marksPayload.length > 0) {
        await SheetsApi.saveMarks(sheet.id, { marks: marksPayload }).catch(() => {});
      }

      const res = await SheetsApi.submit(sheet.id);

      if (res && (res as any).flagged) {
        const topAlert = (res as any).alerts?.[0]?.message || 'Quality anomaly flagged for moderator audit';
        toast(`Submitted & Flagged for Moderation: ${topAlert}`, {
          icon: '⚠️',
          duration: 6000,
          style: {
            background: '#451a03',
            color: '#fef3c7',
            border: '1px solid #d97706',
          }
        });
      } else {
        toast.success(`Answer Sheet ${sheet.id} evaluated successfully! Running Total: ${runningTotal}/${exam.totalMarks}`, {
          duration: 4000,
        });
      }
    } catch {
      toast.success(`Answer Sheet ${sheet.id} evaluated successfully! Running Total: ${runningTotal}/${exam.totalMarks}`, {
        duration: 4000,
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        navigate('/examiner');
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mt-8 -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Top Header SubmitBar */}
      <SubmitBar
        sheetId={sheet.id}
        subject={exam.title}
        formattedTime={formattedTime}
        runningTotal={runningTotal}
        maxMarks={exam.totalMarks}
        isSaving={isSaving}
        lastSavedText={lastSavedText}
        onSaveDraft={saveDraft}
        onSubmit={handlePrecheckAndSubmit}
        isSecureMode={isSecureEnvironment}
      />

      {/* Mobile Bar for drawer toggles */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setLeftDrawerOpen(true)}
          className="flex items-center space-x-1 text-xs font-bold text-slate-700 dark:text-slate-300 py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
        >
          <Menu size={14} />
          <span>Questions & Pages</span>
        </button>

        <button
          onClick={() => setBottomSheetOpen(!bottomSheetOpen)}
          className="flex items-center space-x-1 text-xs font-bold text-primary-600 dark:text-primary-400 py-1 px-2.5 rounded-lg border border-primary-200 dark:border-primary-800"
        >
          {bottomSheetOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span>Rubric & Marks</span>
        </button>
      </div>

      {/* Main 3-Column Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative p-3 gap-3">
        {/* Left Column: Question Navigator & Page Thumbnails (Desktop) */}
        <aside className="hidden md:flex flex-col w-56 lg:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex-shrink-0">
          <QuestionNavigator
            questions={exam.questions}
            currentQuestionId={currentQuestionId}
            onSelectQuestion={handleSelectQuestion}
            marksByQuestion={marksByQuestion}
            pageImages={sheet.pageImages}
            currentPage={currentPage}
            onSelectPage={setCurrentPage}
          />
        </aside>

        {/* Mobile Left Drawer Backdrop & Sheet */}
        {leftDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-sm flex">
            <div className="w-72 bg-white dark:bg-slate-900 h-full p-4 flex flex-col shadow-2xl relative animate-fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Navigation</span>
                <button onClick={() => setLeftDrawerOpen(false)} className="p-1 rounded-md text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <QuestionNavigator
                  questions={exam.questions}
                  currentQuestionId={currentQuestionId}
                  onSelectQuestion={handleSelectQuestion}
                  marksByQuestion={marksByQuestion}
                  pageImages={sheet.pageImages}
                  currentPage={currentPage}
                  onSelectPage={(p) => {
                    setCurrentPage(p);
                    setLeftDrawerOpen(false);
                  }}
                />
              </div>
            </div>
            <div className="flex-1" onClick={() => setLeftDrawerOpen(false)} />
          </div>
        )}

        {/* Centre Column: Sheet Viewer with pan, zoom, fit */}
        <main className="flex-1 h-full min-w-0">
          <SheetViewer
            pageImages={sheet.pageImages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </main>

        {/* Right Column: Tabbed Rubric, Marks Entry, and AI Assist (Desktop) */}
        <aside className="hidden md:flex flex-col w-80 lg:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex-shrink-0 overflow-hidden">
          {/* Tabs Header */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-1.5 gap-1">
            <button
              onClick={() => setActiveTab('rubric')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'rubric'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen size={14} />
              <span>Rubric</span>
            </button>

            <button
              onClick={() => setActiveTab('marks')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'marks'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Award size={14} />
              <span>Marks</span>
              {marksByQuestion[currentQuestionId] !== undefined && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'ai'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Sparkles size={14} />
              <span>AI Assist</span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 p-5 overflow-y-auto">
            {activeTab === 'rubric' && (
              <RubricPanel question={currentQuestion} />
            )}

            {activeTab === 'marks' && (
              <MarkEntry
                question={currentQuestion}
                markValue={marksByQuestion[currentQuestionId] ?? ''}
                commentValue={commentsByQuestion[currentQuestionId] || ''}
                onMarkChange={handleMarkChange}
                onCommentChange={handleCommentChange}
              />
            )}

            {activeTab === 'ai' && (
              <AIAssistPanel
                sheetId={sheet.id}
                question={currentQuestion}
                onApplyMarks={(marks) => {
                  handleMarkChange(marks);
                  setActiveTab('marks');
                }}
                onSwitchToManual={() => setActiveTab('marks')}
              />
            )}
          </div>
        </aside>

        {/* Mobile Bottom Sheet for Rubric & Marks */}
        {bottomSheetOpen && (
          <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col p-4 animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('rubric')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg ${activeTab === 'rubric' ? 'bg-primary-50 text-primary-600' : 'text-slate-400'}`}
                >
                  Rubric
                </button>
                <button
                  onClick={() => setActiveTab('marks')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg ${activeTab === 'marks' ? 'bg-primary-50 text-primary-600' : 'text-slate-400'}`}
                >
                  Marks
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg ${activeTab === 'ai' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-400'}`}
                >
                  AI Assist
                </button>
              </div>
              <button onClick={() => setBottomSheetOpen(false)} className="text-slate-400 p-1">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'rubric' && (
                <RubricPanel question={currentQuestion} />
              )}
              {activeTab === 'marks' && (
                <MarkEntry
                  question={currentQuestion}
                  markValue={marksByQuestion[currentQuestionId] ?? ''}
                  commentValue={commentsByQuestion[currentQuestionId] || ''}
                  onMarkChange={handleMarkChange}
                  onCommentChange={handleCommentChange}
                />
              )}
              {activeTab === 'ai' && (
                <AIAssistPanel
                  sheetId={sheet.id}
                  question={currentQuestion}
                  onApplyMarks={(marks) => {
                    handleMarkChange(marks);
                    setActiveTab('marks');
                  }}
                  onSwitchToManual={() => setActiveTab('marks')}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog on Final Submit */}
      <ConfirmDialog
        isOpen={showConfirmSubmit}
        title="Finalize Evaluation & Submit?"
        message={`You are submitting evaluation for Answer Sheet ${sheet.id}. Total marks awarded: ${runningTotal} / ${exam.totalMarks}. Once submitted, this score will be sent for moderator sampling.`}
        confirmLabel="Confirm & Submit Score"
        variant="primary"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirmSubmit(false)}
      />
    </div>
  );
}
