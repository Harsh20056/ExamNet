import React from 'react';
import { Card } from '../Card';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantStyles = {
  default: 'text-slate-900 dark:text-white',
  primary: 'text-primary-600 dark:text-primary-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

const iconBackgrounds = {
  default: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/30',
  success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30',
  warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30',
  danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className = '',
}) => {
  return (
    <Card className={`flex items-start justify-between ${className}`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <div className="flex items-baseline space-x-2">
          <span className={`text-3xl font-extrabold tracking-tight ${variantStyles[variant]}`}>
            {value}
          </span>
          {trend && (
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {Icon && (
        <div className={`p-3 rounded-xl ${iconBackgrounds[variant]}`}>
          <Icon size={22} />
        </div>
      )}
    </Card>
  );
};
