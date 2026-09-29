import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Lock, HelpCircle, Calendar, FileText } from 'lucide-react';

export interface IntentStatus {
  status: 'Complete' | 'Partial' | 'Blocked' | 'Unresolved';
  reason: string;
  updatedAt?: string | Date;
  metadata?: {
    attemptedQuestions?: number;
    totalQuestions?: number;
    isLocked?: boolean;
    isDraft?: boolean;
  };
}

interface IntentStatusBadgeProps {
  intentStatus?: IntentStatus;
  fallbackStatus?: string; // e.g. student.intent
}

export default function IntentStatusBadge({ intentStatus, fallbackStatus }: IntentStatusBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Normalize status if not fully populated
  const status = intentStatus?.status || (fallbackStatus ? (
    fallbackStatus.charAt(0).toUpperCase() + fallbackStatus.slice(1).toLowerCase()
  ) : 'Unresolved') as IntentStatus['status'];

  const reason = intentStatus?.reason || (fallbackStatus ? `Intent is currently set to ${fallbackStatus.toLowerCase()}.` : 'Attempt status is unresolved.');
  const updatedAt = intentStatus?.updatedAt;
  const metadata = intentStatus?.metadata;

  // Determine styling based on status
  const getStatusStyles = (statusType: IntentStatus['status']) => {
    switch (statusType) {
      case 'Complete':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/20',
          text: 'text-emerald-700 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-800/30',
          iconColor: 'text-emerald-500',
          indicator: 'bg-emerald-500',
          icon: CheckCircle2,
        };
      case 'Partial':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/20',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800/30',
          iconColor: 'text-amber-500',
          indicator: 'bg-amber-500',
          icon: AlertTriangle,
        };
      case 'Blocked':
        return {
          bg: 'bg-red-50 dark:bg-red-950/20',
          text: 'text-red-700 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800/30',
          iconColor: 'text-red-500',
          indicator: 'bg-red-500',
          icon: Lock,
        };
      case 'Unresolved':
      default:
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/20',
          text: 'text-indigo-700 dark:text-indigo-400',
          border: 'border-indigo-200 dark:border-indigo-800/30',
          iconColor: 'text-indigo-500',
          indicator: 'bg-indigo-500',
          icon: HelpCircle,
        };
    }
  };

  const styles = getStatusStyles(status);
  const Icon = styles.icon;

  const formattedTime = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles.bg} ${styles.text} ${styles.border} shadow-sm transition-all focus:outline-none`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${styles.indicator} animate-pulse`}></span>
        <Icon size={12} className={styles.iconColor} />
        <span>{status}</span>
      </motion.button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 dark:bg-slate-950 border border-slate-800 text-white rounded-xl shadow-2xl p-4 z-50 pointer-events-none"
          >
            {/* Popover Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-950"></div>

            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Attempt Breakdown</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${styles.bg} ${styles.text}`}>
                {status}
              </span>
            </h4>

            <p className="text-sm font-semibold text-white leading-relaxed mb-3">
              {reason}
            </p>

            <div className="border-t border-slate-850 pt-2.5 space-y-1.5 text-[10px] text-slate-400 font-medium">
              {metadata && typeof metadata.attemptedQuestions === 'number' && typeof metadata.totalQuestions === 'number' && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1"><FileText size={10} /> Progress</span>
                  <span className="font-bold text-white">
                    {metadata.attemptedQuestions} / {metadata.totalQuestions} Questions
                  </span>
                </div>
              )}
              {formattedTime && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1"><Calendar size={10} /> Evaluated At</span>
                  <span className="font-bold text-white">{formattedTime}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
