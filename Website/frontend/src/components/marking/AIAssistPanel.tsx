import React, { useState } from 'react';
import type { Question } from '../../types';
import { 
  fetchAISuggestion, 
  logAIDecision, 
  type AISuggestionResponse 
} from '../../services/ai';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Check, 
  Edit3, 
  Info,
  PenTool,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface AIAssistPanelProps {
  sheetId: string;
  question: Question;
  onApplyMarks: (marks: number) => void;
  onSwitchToManual: () => void;
  className?: string;
}

export const AIAssistPanel: React.FC<AIAssistPanelProps> = ({
  sheetId,
  question,
  onApplyMarks,
  onSwitchToManual,
  className = '',
}) => {
  // Loading & State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AISuggestionResponse | null>(null);

  // Override Drawer state
  const [showOverride, setShowOverride] = useState(false);
  const [overrideMark, setOverrideMark] = useState<string>('');
  const [overrideNote, setOverrideNote] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const handleAskAI = async () => {
    setLoading(true);
    setError(null);
    setShowOverride(false);

    try {
      const res = await fetchAISuggestion(sheetId, question);
      setSuggestion(res);
      setOverrideMark(res.suggestedMarks.toString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI Service is currently unavailable';
      setError(msg);
      toast.error('AI assistant offline. You can grade manually.', { duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!suggestion) return;
    setIsSubmittingDecision(true);

    try {
      await logAIDecision({
        sheetId,
        questionId: question.id,
        action: 'accept',
        suggestedMarks: suggestion.suggestedMarks,
        finalMarks: suggestion.suggestedMarks,
        timestamp: new Date().toISOString(),
      });

      onApplyMarks(suggestion.suggestedMarks);
      toast.success(`Applied AI suggested ${suggestion.suggestedMarks} marks to Q${question.questionNumber}.`, {
        icon: '✨',
      });
    } catch {
      onApplyMarks(suggestion.suggestedMarks);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion) return;

    const finalNum = parseFloat(overrideMark);
    if (isNaN(finalNum) || finalNum < 0 || finalNum > question.maxMarks) {
      toast.error(`Override marks must be between 0 and ${question.maxMarks}!`);
      return;
    }

    setIsSubmittingDecision(true);
    try {
      await logAIDecision({
        sheetId,
        questionId: question.id,
        action: 'override',
        suggestedMarks: suggestion.suggestedMarks,
        finalMarks: finalNum,
        overrideNote: overrideNote.trim() || undefined,
        timestamp: new Date().toISOString(),
      });

      onApplyMarks(finalNum);
      setShowOverride(false);
      toast.success(`Override saved: ${finalNum} marks awarded to Q${question.questionNumber}.`, {
        icon: '✍️',
      });
    } catch {
      onApplyMarks(finalNum);
      setShowOverride(false);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  return (
    <div className={`space-y-5 text-sm ${className}`}>
      {/* Advisory Notice Header */}
      <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-3 flex items-start space-x-2.5">
        <Info size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
          <span className="font-bold">AI Suggestion Advisory:</span> Output represents an automated rubric recommendation. The human examiner remains the sole authorizer and decision maker.
        </div>
      </div>

      {/* Main Action Bar if no suggestion loaded */}
      {!suggestion && !loading && !error && (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              AI Evaluation & OCR Assistant
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Analyze student handwriting on Question {question.questionNumber} against benchmark rubric points.
            </p>
          </div>
          <button
            onClick={handleAskAI}
            className="btn-primary py-2 px-5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-indigo-500/20"
          >
            <Sparkles size={14} />
            <span>Ask AI for Q{question.questionNumber}</span>
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-10 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3 animate-fade-in">
          <Loader2 size={30} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <div className="space-y-1">
            <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              Running OCR Transcription & Alignment...
            </h5>
            <p className="text-[11px] text-slate-400">
              Comparing script with model answer and rubric criteria (~1.5s)
            </p>
          </div>
        </div>
      )}

      {/* Error / AI Unavailable State */}
      {error && !loading && (
        <div className="p-5 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-bold text-red-900 dark:text-red-200">AI Unavailable</h5>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-red-200/50 dark:border-red-900/40">
            <button
              onClick={handleAskAI}
              className="py-1.5 px-3 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-xs font-semibold text-red-700 dark:text-red-300 shadow-sm"
            >
              Retry
            </button>
            <button
              onClick={onSwitchToManual}
              className="py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <PenTool size={13} />
              <span>Mark manually</span>
            </button>
          </div>
        </div>
      )}

      {/* Output Content */}
      {suggestion && !loading && (
        <div className="space-y-4 animate-fade-in">
          {/* Header Card: Confidence and Suggested Score */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  AI Suggestion
                </span>
                {suggestion.cached && (
                  <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                    cached
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800 text-[11px] font-bold text-indigo-700 dark:text-indigo-400">
                <Clock size={11} />
                <span>{suggestion.confidence}% OCR Confidence</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-3">
              <div>
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
                  Suggested Mark
                </span>
                <span className="text-3xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                  {suggestion.suggestedMarks}{' '}
                  <span className="text-sm font-normal text-slate-400">/ {question.maxMarks}</span>
                </span>
              </div>

              {/* Action Buttons: Accept / Override */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isSubmittingDecision}
                  className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Check size={14} />
                  <span>Accept Mark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOverride(!showOverride)}
                  className="py-2 px-3.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Edit3 size={14} />
                  <span>Override</span>
                </button>
              </div>
            </div>

            {/* AI Evaluator Reasoning */}
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 leading-relaxed font-sans">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Reasoning: </span>
              {suggestion.reason}
            </p>
          </div>

          {/* Override Form Drawer */}
          {showOverride && (
            <form onSubmit={handleOverrideSubmit} className="p-4 bg-slate-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl space-y-3 animate-fade-in shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  Manual Examiner Override
                </span>
                <span className="text-[10px] text-slate-400">Max: {question.maxMarks} marks</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Adjusted Score (Halves allowed)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={question.maxMarks}
                  required
                  value={overrideMark}
                  onChange={(e) => setOverrideMark(e.target.value)}
                  className="w-full text-base font-bold font-mono px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Audit Justification Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  placeholder="Reason for overriding AI suggestion (e.g. alternate correct formulation)..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOverride(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDecision}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Apply Override
                </button>
              </div>
            </form>
          )}

          {/* Optical OCR Transcription */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Handwriting Transcription (Read-Only)
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-750">
              {suggestion.transcription}
            </p>
          </div>

          {/* Matched Points */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Matched Rubric Points ({suggestion.matchedPoints.length})
            </span>
            <div className="space-y-1.5">
              {suggestion.matchedPoints.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-lg flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </div>
              ))}
              {suggestion.matchedPoints.length === 0 && (
                <p className="text-xs text-slate-400 italic">No exact rubric matches identified.</p>
              )}
            </div>
          </div>

          {/* Missed Points */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
              Missed / Incomplete Points ({suggestion.missedPoints.length})
            </span>
            <div className="space-y-1.5">
              {suggestion.missedPoints.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-lg flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-300"
                >
                  <XCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </div>
              ))}
              {suggestion.missedPoints.length === 0 && (
                <p className="text-xs text-slate-400 italic">All rubric points were covered by student.</p>
              )}
            </div>
          </div>

          {/* Re-analyze Button */}
          <div className="pt-2 text-center">
            <button
              onClick={handleAskAI}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
            >
              Re-analyze with AI
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
