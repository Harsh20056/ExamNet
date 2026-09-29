import React from 'react';
import { Card } from '../Card';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

interface AlertToastProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const icons = {
  info: <Info size={18} className="text-blue-500" />,
  success: <CheckCircle size={18} className="text-emerald-500" />,
  warning: <AlertTriangle size={18} className="text-amber-500" />,
  error: <AlertCircle size={18} className="text-red-500" />,
};

const borderStyles = {
  info: 'border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20',
  success: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20',
  warning: 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20',
  error: 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20',
};

export const AlertToast: React.FC<AlertToastProps> = ({
  type = 'info',
  title,
  message,
  onDismiss,
  className = '',
}) => {
  return (
    <Card className={`p-4 ${borderStyles[type]} flex items-start justify-between gap-3 shadow-md ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="mt-0.5">{icons[type]}</div>
        <div>
          <h5 className="text-xs font-bold text-slate-900 dark:text-white">{title}</h5>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </Card>
  );
};
