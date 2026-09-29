import React from 'react';
import type { Question } from '../../types';
import { BookOpen, CheckSquare, Sparkles } from 'lucide-react';

interface RubricPanelProps {
  question: Question;
  className?: string;
}

export const RubricPanel: React.FC<RubricPanelProps> = ({ question, className = '' }) => {
  return (
    <div className={`space-y-6 text-sm text-slate-800 dark:text-slate-200 overflow-y-auto max-h-full pr-1 ${className}`}>
      {/* Question Prompt */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2 text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">
          <BookOpen size={15} />
          <span>Question {question.questionNumber} (Max: {question.maxMarks} Marks)</span>
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
          {question.title}
        </p>
      </div>

      {/* Model Answer */}
      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40">
        <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
          <Sparkles size={15} />
          <span>Official Benchmark Answer</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
          {question.modelAnswer}
        </p>
      </div>

      {/* Step-by-Step Rubric Points */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <CheckSquare size={15} />
          <span>Grading Rubric Breakdown</span>
        </div>

        <div className="space-y-2">
          {question.rubric.map((r, idx) => (
            <div
              key={r.id || idx}
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start space-x-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal">
                  {r.criterion}
                </p>
              </div>
              <span className="flex-shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200/60 dark:border-primary-800/50">
                +{r.points}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
