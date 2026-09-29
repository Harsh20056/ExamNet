import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '../../hooks/useAlerts';

interface AlertBellProps {
  count?: number;
  className?: string;
}

export const AlertBell: React.FC<AlertBellProps> = ({
  count: propCount,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { alerts, activeCount } = useAlerts();

  const displayCount = propCount !== undefined ? propCount : activeCount;
  const recentAlerts = alerts.slice(0, 5);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors focus:outline-none"
        aria-label="Alerts"
      >
        <Bell size={20} />
        {displayCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Marking Anomaly Alerts</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                {displayCount} active
              </span>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                navigate('/controller/alerts');
              }}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              View All
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => {
                  setOpen(false);
                  navigate('/controller/alerts');
                }}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                    alert.severity === 'critical'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      : alert.severity === 'high'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 line-clamp-2">
                  {alert.message}
                </p>
                <span className="text-[10px] font-mono text-primary-600 dark:text-primary-400 mt-1 inline-block">
                  Sheet: {alert.sheetId}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
