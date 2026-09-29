import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw
} from 'lucide-react';
import { mockSheets, mockExam, mockAlerts } from '../../mock/data';
import { SheetViewer } from '../../components/marking/SheetViewer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

interface ModerationDecisionRecord {
  sheetId: string;
  action: 'approve' | 'adjust' | 'send_back';
  reason: string;
  adjustedMarks?: Record<string, number>;
  timestamp: string;
}

export default function ReviewSheet() {
  const { sheetId = 'sheet-002' } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();

  // Find target sheet
  const sheet = useMemo(() => {
    return mockSheets.find((s) => s.id === sheetId) || mockSheets[1];
  }, [sheetId]);

  const exam = mockExam;

  // Find related alerts
  const sheetAlerts = useMemo(() => {
    return mockAlerts.filter((a) => a.sheetId === sheet.id);
  }, [sheet.id]);

  // Current page state for SheetViewer
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Per-question marks awarded by the original examiner (mock breakdown)
  const initialExaminerMarks: Record<string, number> = useMemo(() => {
    return {
      q1: 5.0,
      q2: 10.0,
      q3: 8.0,
      q4: 7.0,
      q5: 10.0, // Often flagged for high speed
      q6: 10.0,
      q7: 9.0,
      q8: 9.0,
    };
  }, []);

  // AI suggested marks benchmark
  const aiSuggestions: Record<string, number> = useMemo(() => {
    return {
      q1: 4.5,
      q2: 9.5,
      q3: 6.5,
      q4: 6.0,
      q5: 7.0, // Large variance: Examiner gave 10, AI suggested 7.0
      q6: 8.0,
      q7: 8.5,
      q8: 8.0,
    };
  }, []);

  // State for moderator-adjusted marks
  const [adjustedMarks, setAdjustedMarks] = useState<Record<string, number>>(() => ({
    ...initialExaminerMarks,
  }));

  // Moderation reason text box state (mandatory)
  const [moderatorReason, setModeratorReason] = useState<string>('');
  const [reasonError, setReasonError] = useState<string>('');

  // Dialog states
  const [pendingAction, setPendingAction] = useState<'approve' | 'adjust' | 'send_back' | null>(null);

  // Calculate totals
  const examinerTotal = useMemo(() => {
    return Object.values(initialExaminerMarks).reduce((sum, val) => sum + val, 0);
  }, [initialExaminerMarks]);

  const aiTotal = useMemo(() => {
    return Object.values(aiSuggestions).reduce((sum, val) => sum + val, 0);
  }, [aiSuggestions]);

  const moderatorTotal = useMemo(() => {
    return Object.values(adjustedMarks).reduce((sum, val) => sum + val, 0);
  }, [adjustedMarks]);

  const handleMarkAdjustment = (questionId: string, value: string, maxMarks: number) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      setAdjustedMarks((prev) => ({ ...prev, [questionId]: 0 }));
      return;
    }
    const clamped = Math.max(0, Math.min(maxMarks, Math.round(num * 2) / 2));
    setAdjustedMarks((prev) => ({ ...prev, [questionId]: clamped }));
  };

  const handleTriggerAction = (action: 'approve' | 'adjust' | 'send_back') => {
    if (!moderatorReason.trim()) {
      setReasonError('A detailed reason is required before submitting your moderation decision.');
      return;
    }
    setReasonError('');
    setPendingAction(action);
  };

  const handleConfirmDecision = () => {
    if (!pendingAction) return;

    const decisionRecord: ModerationDecisionRecord = {
      sheetId: sheet.id,
      action: pendingAction,
      reason: moderatorReason.trim(),
      adjustedMarks: pendingAction === 'adjust' ? adjustedMarks : undefined,
      timestamp: new Date().toISOString(),
    };

    // Save decision to localStorage
    try {
      const existingDecisions: ModerationDecisionRecord[] = JSON.parse(
        localStorage.getItem('moderation_decisions') || '[]'
      );
      existingDecisions.push(decisionRecord);
      localStorage.setItem('moderation_decisions', JSON.stringify(existingDecisions));

      // Remove sheet from moderation queue
      const resolvedSheets: string[] = JSON.parse(
        localStorage.getItem('moderated_resolved_sheets') || '[]'
      );
      if (!resolvedSheets.includes(sheet.id)) {
        resolvedSheets.push(sheet.id);
        localStorage.setItem('moderated_resolved_sheets', JSON.stringify(resolvedSheets));
      }
    } catch (err) {
      console.error('Failed to persist moderation decision:', err);
    }

    const actionText =
      pendingAction === 'approve'
        ? 'Approved without changes'
        : pendingAction === 'adjust'
        ? `Adjusted to ${moderatorTotal} Marks`
        : 'Sent back to Examiner for re-evaluation';

    toast.success(`Sheet ${sheet.id} moderation complete: ${actionText}`, {
      duration: 4000,
      icon: '🛡️',
    });

    setPendingAction(null);

    // Sheet leaves the queue and navigates back to /moderator
    setTimeout(() => {
      navigate('/moderator');
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mt-8 -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Top Header Bar */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/moderator')}
            className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Moderation Queue</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded border border-primary-200/50 dark:border-primary-800/40">
              {sheet.id}
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline">
              {exam.title} ({exam.code})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="hidden md:flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono">
            <span className="text-slate-500">Original:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{examinerTotal}/{exam.totalMarks}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">AI:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{aiTotal}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Moderated:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{moderatorTotal}</span>
          </div>

          <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <ShieldCheck size={13} />
            <span>Moderator Review</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Side: SheetViewer with zoom, pan, and page navigation */}
        <div className="flex-1 h-full min-w-0 p-3 sm:p-4 bg-slate-200/60 dark:bg-slate-950/80">
          <SheetViewer
            pageImages={sheet.pageImages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            className="h-full"
          />
        </div>

        {/* Right Side: Per-Question Comparison Table & Moderation Actions */}
        <div className="w-full md:w-[480px] lg:w-[540px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 h-full overflow-hidden shadow-xl">
          {/* Related Anomaly Flags Warning */}
          {sheetAlerts.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/40 p-3.5 flex items-start space-x-2.5 text-xs text-red-800 dark:text-red-200 flex-shrink-0">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Active Anomaly Flags: </span>
                <span>{sheetAlerts.map((a) => a.message).join(' • ')}</span>
              </div>
            </div>
          )}

          {/* Table Header & Info */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Per-Question Mark Variance Analysis
              </h3>
              <p className="text-xs text-slate-500">
                Compare original examiner marks against automated AI calibration benchmarks.
              </p>
            </div>
          </div>

          {/* Comparison Table (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Q#</th>
                    <th className="py-2.5 px-3 text-center">Examiner</th>
                    <th className="py-2.5 px-3 text-center">AI Suggestion</th>
                    <th className="py-2.5 px-3 text-center">Diff</th>
                    <th className="py-2.5 px-3 text-center">Flag</th>
                    <th className="py-2.5 px-3 text-right">Moderator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {exam.questions.map((q) => {
                    const exMark = initialExaminerMarks[q.id] ?? 0;
                    const aiMark = aiSuggestions[q.id] ?? 0;
                    const diff = Number((exMark - aiMark).toFixed(1));
                    const isVarianceHigh = Math.abs(diff) >= 2.0;
                    const modMark = adjustedMarks[q.id] ?? exMark;

                    return (
                      <tr
                        key={q.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isVarianceHigh ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                          Q{q.questionNumber}
                          <span className="text-[10px] text-slate-400 font-normal block">
                            Max {q.maxMarks}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                          {exMark}
                        </td>
                        <td className="py-2.5 px-3 text-center text-indigo-600 dark:text-indigo-400 font-semibold">
                          {aiMark}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-bold ${
                              diff > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : diff < 0
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isVarianceHigh ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
                              Variance
                            </span>
                          ) : (
                            <span className="text-emerald-500 font-sans text-xs">✓ Normal</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={q.maxMarks}
                            value={modMark}
                            onChange={(e) => handleMarkAdjustment(q.id, e.target.value, q.maxMarks)}
                            className="w-16 py-1 px-2 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mandatory Moderator Decision Reason Input */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <span>Mandatory Moderation Justification & Audit Note</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400">Recorded in audit ledger</span>
              </div>
              <textarea
                rows={3}
                value={moderatorReason}
                onChange={(e) => {
                  setModeratorReason(e.target.value);
                  if (reasonError) setReasonError('');
                }}
                placeholder="Detail the technical or rubric basis for approving, adjusting marks, or sending this answer script back to the examiner..."
                className={`w-full p-3 text-xs rounded-xl border ${
                  reasonError
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-primary-500'
                } bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-1 resize-none`}
              />
              {reasonError && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {reasonError}
                </p>
              )}
            </div>
          </div>

          {/* Action Decision Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 space-y-3 flex-shrink-0">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Moderator Final Marks:</span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white">
                {moderatorTotal} / {exam.totalMarks}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* 1. Approve */}
              <button
                type="button"
                onClick={() => handleTriggerAction('approve')}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Approve</span>
              </button>

              {/* 2. Adjust */}
              <button
                type="button"
                onClick={() => handleTriggerAction('adjust')}
                className="py-2.5 px-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary-600/20 flex items-center justify-center space-x-1.5"
              >
                <ShieldCheck size={14} />
                <span>Adjust</span>
              </button>

              {/* 3. Send Back */}
              <button
                type="button"
                onClick={() => handleTriggerAction('send_back')}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-600/20 flex items-center justify-center space-x-1.5"
              >
                <RotateCcw size={14} />
                <span>Send Back</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Decision */}
      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={
          pendingAction === 'approve'
            ? 'Confirm Moderation Approval'
            : pendingAction === 'adjust'
            ? 'Confirm Mark Adjustment'
            : 'Send Back to Examiner'
        }
        message={
          pendingAction === 'approve'
            ? `Are you sure you want to approve sheet ${sheet.id} with original marks (${examinerTotal}/${exam.totalMarks})? This script will be marked final and leave the moderation queue.`
            : pendingAction === 'adjust'
            ? `Confirm adjusted score of ${moderatorTotal}/${exam.totalMarks} for sheet ${sheet.id}? The calibrated score and your justification will be locked in the audit trail.`
            : `Send sheet ${sheet.id} back to the examiner for re-evaluation? The examiner will be required to address your noted feedback.`
        }
        confirmLabel={
          pendingAction === 'approve'
            ? 'Confirm Approval'
            : pendingAction === 'adjust'
            ? 'Save Adjusted Marks'
            : 'Return Script to Examiner'
        }
        variant={pendingAction === 'send_back' ? 'danger' : 'primary'}
        onConfirm={handleConfirmDecision}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
