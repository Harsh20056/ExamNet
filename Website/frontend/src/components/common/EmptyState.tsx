import React from 'react';
import { Card } from '../Card';
import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <Card className={`p-10 text-center flex flex-col items-center justify-center border-dashed ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
        <Icon size={24} />
      </div>
      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-primary mt-4 py-2 px-4 text-xs font-semibold">
          {actionText}
        </button>
      )}
    </Card>
  );
};
