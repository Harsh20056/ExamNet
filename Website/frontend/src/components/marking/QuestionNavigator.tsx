import React from 'react';
import type { Question } from '../../types';
import { CheckCircle2, Circle, AlertCircle, FileText } from 'lucide-react';

interface QuestionNavigatorProps {
  questions: Question[];
  currentQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  marksByQuestion: Record<string, number | undefined>;
  flaggedQuestions?: string[];
  pageImages: string[];
  currentPage: number;
  onSelectPage: (pageNumber: number) => void;
  className?: string;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  questions,
  currentQuestionId,
  onSelectQuestion,
  marksByQuestion,
  flaggedQuestions = [],
  pageImages,
  currentPage,
  onSelectPage,
  className = '',
}) => {
  return (
    <div className={`flex flex-col h-full space-y-6 ${className}`}>
      {/* Questions Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Questions ({questions.length})
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {Object.keys(marksByQuestion).filter(k => marksByQuestion[k] !== undefined && marksByQuestion[k] !== null).length}/{questions.length} marked
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {questions.map((q) => {
            const isSelected = q.id === currentQuestionId;
            const isMarked = marksByQuestion[q.id] !== undefined && marksByQuestion[q.id] !== null;
            const isFlagged = flaggedQuestions.includes(q.id);

            return (
              <button
                key={q.id}
                onClick={() => onSelectQuestion(q.id)}
                className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    Q{q.questionNumber}
                  </span>
                  {isFlagged ? (
                    <AlertCircle size={14} className="text-red-500" />
                  ) : isMarked ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : (
                    <Circle size={12} className="text-slate-300 dark:text-slate-600" />
                  )}
                </div>

                <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-400">Max: {q.maxMarks}</span>
                  <span className={`text-[11px] font-bold font-mono ${isMarked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {isMarked ? marksByQuestion[q.id] : '—'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Page Thumbnails Section */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-0">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Script Pages ({pageImages.length})
        </span>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {pageImages.map((_img, idx) => {
            const pageNum = idx + 1;
            const isCurrent = pageNum === currentPage;

            return (
              <div
                key={pageNum}
                onClick={() => onSelectPage(pageNum)}
                className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center space-x-3 ${
                  isCurrent
                    ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/30 ring-1 ring-primary-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-14 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <FileText size={18} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${isCurrent ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    Page {pageNum}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Tap to view
                  </p>
                </div>
                {isCurrent && (
                  <span className="w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
