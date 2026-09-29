import React from 'react';
import type { Question } from '../../types';
import { Award, MessageSquare, AlertCircle } from 'lucide-react';

interface MarkEntryProps {
  question: Question;
  markValue: number | string;
  commentValue: string;
  onMarkChange: (val: number | string) => void;
  onCommentChange: (comment: string) => void;
  className?: string;
}

export const MarkEntry: React.FC<MarkEntryProps> = ({
  question,
  markValue,
  commentValue,
  onMarkChange,
  onCommentChange,
  className = '',
}) => {
  const numericMark = typeof markValue === 'string' ? parseFloat(markValue) : markValue;
  const isExceeded = !isNaN(numericMark) && numericMark > question.maxMarks;
  const isNegative = !isNaN(numericMark) && numericMark < 0;
  const hasError = isExceeded || isNegative;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onMarkChange('');
      return;
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onMarkChange(val);
    }
  };

  const setQuickMark = (val: number) => {
    onMarkChange(val);
  };

  return (
    <div className={`space-y-6 text-sm ${className}`}>
      {/* Mark Entry Header */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Evaluation Score
          </span>
          <span className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">
            Maximum: {question.maxMarks} marks
          </span>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center">
            <Award size={15} className="mr-1.5 text-primary-600 dark:text-primary-400" />
            Enter Awarded Mark (Halves Allowed e.g. 2.5, 4.0)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.5"
              min="0"
              max={question.maxMarks}
              value={markValue}
              onChange={handleInputChange}
              placeholder={`0 - ${question.maxMarks}`}
              className={`w-full text-2xl font-bold font-mono px-4 py-2.5 rounded-xl border transition-all ${
                hasError
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-600 focus:ring-2 focus:ring-red-500'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500'
              }`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              / {question.maxMarks}
            </span>
          </div>

          {hasError && (
            <div className="flex items-center space-x-1.5 text-red-600 dark:text-red-400 text-xs font-semibold mt-2 animate-fade-in">
              <AlertCircle size={14} />
              <span>
                {isExceeded
                  ? `Mark exceeds maximum limit! Allowed range: 0 to ${question.maxMarks}`
                  : 'Marks cannot be negative.'}
              </span>
            </div>
          )}
        </div>

        {/* Quick Marks Pill Buttons */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/80">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Quick Scores:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[0, Math.floor(question.maxMarks / 2), question.maxMarks].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuickMark(preset)}
                className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Evaluator Comment & Rubric Notes */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center">
          <MessageSquare size={15} className="mr-1.5 text-slate-500" />
          Examiner Feedback & Observation Notes (Optional)
        </label>
        <textarea
          rows={4}
          value={commentValue}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Record notes on calculation steps, clarity of explanation, or deductions..."
          className="w-full text-xs p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none shadow-sm"
        />
      </div>
    </div>
  );
};
