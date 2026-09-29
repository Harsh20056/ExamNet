import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100 or current
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorMap = {
  primary: 'bg-primary-600 dark:bg-primary-500',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  rose: 'bg-rose-500 dark:bg-rose-400',
  indigo: 'bg-indigo-600 dark:bg-indigo-500',
};

const heightMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
  color = 'primary',
  size = 'md',
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-600 dark:text-slate-400">
          {label && <span>{label}</span>}
          {showPercentage && <span className="font-mono font-bold text-slate-900 dark:text-white">{percentage}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden ${heightMap[size]}`}>
        <div
          className={`${heightMap[size]} ${colorMap[color]} transition-all duration-500 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
