import type { SheetStatus } from '../../types';

interface StatusBadgeProps {
  status: SheetStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const normalized = status.toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  let dotColor = 'bg-slate-400';

  if (normalized === 'pending') {
    styles = 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50';
    dotColor = 'bg-amber-500';
  } else if (normalized === 'in progress') {
    styles = 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50';
    dotColor = 'bg-blue-500 animate-pulse';
  } else if (normalized === 'flagged') {
    styles = 'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50';
    dotColor = 'bg-red-500';
  } else if (normalized === 'final') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50';
    dotColor = 'bg-emerald-500';
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center space-x-1.5 font-semibold rounded-full border tracking-wide uppercase ${sizeClass} ${styles} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
};
