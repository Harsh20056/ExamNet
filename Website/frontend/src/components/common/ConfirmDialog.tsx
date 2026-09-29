import React from 'react';
import { Card } from '../Card';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;

  const confirmBtnStyles =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'btn-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-start space-x-3.5 mb-4">
          <div
            className={`p-2.5 rounded-xl ${
              variant === 'danger'
                ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
            }`}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center ${confirmBtnStyles} disabled:opacity-50`}
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </Card>
    </div>
  );
};
