import React from 'react';
import { Save, Send, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { AlertBell } from '../common/AlertBell';

interface SubmitBarProps {
  sheetId: string;
  subject: string;
  formattedTime: string;
  runningTotal: number;
  maxMarks: number;
  isSaving: boolean;
  lastSavedText: string;
  onSaveDraft: () => void;
  onSubmit: () => void;
  className?: string;
  isSecureMode?: boolean;
}

export const SubmitBar: React.FC<SubmitBarProps> = ({
  sheetId,
  subject,
  formattedTime,
  runningTotal,
  maxMarks,
  isSaving,
  lastSavedText,
  onSaveDraft,
  onSubmit,
  className = '',
  isSecureMode = false,
}) => {
  return (
    <header className={`bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-4 select-none ${className}`}>
      {/* Left: Script & Exam Meta */}
      <div className="flex items-center space-x-3">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
              {sheetId}
            </span>
            {isSecureMode ? (
              <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                <ShieldCheck size={12} className="text-red-600 dark:text-red-400" />
                <span>Secure mode ON</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                <ShieldCheck size={12} />
                <span>Standard Mode</span>
              </div>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
            {subject}
          </span>
        </div>
      </div>

      {/* Middle: Active Working Timer & Running Total */}
      <div className="flex items-center space-x-6">
        {/* Working Active Timer */}
        <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 px-3 py-1.5 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
              Working Time
            </span>
            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 leading-tight">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Running Score Tally */}
        <div className="flex items-center space-x-2 bg-primary-50/60 dark:bg-primary-950/30 border border-primary-200/60 dark:border-primary-800/50 px-3 py-1.5 rounded-xl">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider leading-none">
              Running Total
            </span>
            <span className="text-sm font-mono font-extrabold text-primary-700 dark:text-primary-300 leading-tight">
              {runningTotal} <span className="text-xs font-normal text-slate-400">/ {maxMarks}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: Autosave Status, Actions, and AlertBell */}
      <div className="flex items-center space-x-2.5">
        {/* Autosave Indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-400 font-medium mr-1">
          {isSaving ? (
            <>
              <Loader2 size={13} className="animate-spin text-primary-500" />
              <span>Saving draft...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>{lastSavedText}</span>
            </>
          )}
        </div>

        {/* Save Draft Button */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSaving}
          className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Save size={14} />
          <span>Save Draft</span>
        </button>

        {/* Final Submit Button */}
        <button
          type="button"
          onClick={onSubmit}
          className="btn-primary py-1.5 px-4 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Send size={14} />
          <span>Finalize & Submit</span>
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

        {/* Header AlertBell wired to useAlerts */}
        <AlertBell />
      </div>
    </header>
  );
};
