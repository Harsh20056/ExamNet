import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  Layers, 
  ArrowRight 
} from 'lucide-react';
import { mockSheets, mockAlerts, mockExaminers } from '../../mock/data';
import { StatCard, DataTable, type Column } from '../../components/common';
import type { Alert } from '../../types';

interface FlaggedSheetRow {
  id: string;
  sheetId: string;
  examinerId?: string;
  examinerName: string;
  reasons: string[];
  severity: Alert['severity'];
  age: string;
  timestamp: string;
  totalScore: number;
  maxScore: number;
}

export default function ModerationQueue() {
  const navigate = useNavigate();

  // Load flagged sheets from localStorage (to reflect sheets that leave the queue after moderation decision)
  const [removedSheetIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('moderated_resolved_sheets') || '[]');
    } catch {
      return [];
    }
  });

  // Keep live alert list state
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>(() => {
    return mockAlerts.filter(a => !a.resolved);
  });

  // Calculate age string (e.g. "12m ago", "1h ago")
  const formatAge = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Build Flagged Sheets Table Data
  const flaggedSheets: FlaggedSheetRow[] = useMemo(() => {
    // Collect sheets explicitly marked as flagged or associated with active alerts
    return mockSheets
      .filter((s) => !removedSheetIds.includes(s.id))
      .filter((s) => s.status === 'flagged' || mockAlerts.some((a) => a.sheetId === s.id && !a.resolved))
      .map((sheet) => {
        const examiner = mockExaminers.find((e) => e.id === sheet.allocatedExaminerId);
        const relatedAlerts = mockAlerts.filter((a) => a.sheetId === sheet.id);

        const reasons: string[] = [];
        if (sheet.flagReason) {
          reasons.push(sheet.flagReason);
        }
        relatedAlerts.forEach((a) => {
          if (!reasons.includes(a.message)) {
            reasons.push(a.message);
          }
        });
        if (reasons.length === 0) {
          reasons.push('Sampling anomaly: High standard deviation from model answer');
        }

        // Determine highest severity
        let severity: Alert['severity'] = 'medium';
        if (relatedAlerts.some((a) => a.severity === 'critical')) severity = 'critical';
        else if (relatedAlerts.some((a) => a.severity === 'high')) severity = 'high';
        else if (relatedAlerts.some((a) => a.severity === 'low') && relatedAlerts.length === 1) severity = 'low';

        const timestamp = sheet.lastUpdated || sheet.submittedAt || new Date().toISOString();

        return {
          id: sheet.id,
          sheetId: sheet.id,
          examinerId: sheet.allocatedExaminerId,
          examinerName: examiner?.name || 'Allocated Examiner',
          reasons,
          severity,
          age: formatAge(timestamp),
          timestamp,
          totalScore: sheet.totalScore || 0,
          maxScore: sheet.maxPossibleScore,
        };
      });
  }, [removedSheetIds]);

  const handleOpenSheet = (sheetId: string) => {
    navigate(`/moderator/review/${sheetId}`);
  };

  const handleDismissAlert = (alertId: string) => {
    setLiveAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const severityBadgeClass = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      case 'low':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
    }
  };

  const columns: Column<FlaggedSheetRow>[] = [
    {
      key: 'sheetId',
      header: 'Sheet ID',
      className: 'w-36 font-mono font-bold text-slate-900 dark:text-slate-100',
      render: (row) => (
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-md text-xs font-mono font-semibold">
          {row.sheetId}
        </span>
      ),
    },
    {
      key: 'examiner',
      header: 'Assigned Examiner',
      className: 'w-52',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {row.examinerName}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            ID: {row.examinerId}
          </div>
        </div>
      ),
    },
    {
      key: 'reasons',
      header: 'Anomaly Reason(s)',
      render: (row) => (
        <div className="space-y-1 py-1 max-w-md">
          {row.reasons.map((r, i) => (
            <div key={i} className="flex items-start space-x-1.5 text-xs text-slate-700 dark:text-slate-300">
              <span className="text-red-500 font-bold">•</span>
              <span className="leading-snug">{r}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      align: 'center',
      className: 'w-28',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${severityBadgeClass(
            row.severity
          )}`}
        >
          {row.severity}
        </span>
      ),
    },
    {
      key: 'age',
      header: 'Age',
      className: 'w-28',
      render: (row) => (
        <div className="flex items-center space-x-1 text-xs text-slate-500 font-medium">
          <Clock size={12} className="text-slate-400" />
          <span>{row.age}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      className: 'w-28',
      render: (row) => (
        <button
          onClick={() => handleOpenSheet(row.sheetId)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-semibold shadow-sm shadow-primary-500/20 transition-all"
        >
          <span>Open</span>
          <ArrowRight size={13} />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 mb-2 border border-indigo-200/50 dark:border-indigo-800/40">
            <ShieldAlert size={12} className="text-indigo-600 dark:text-indigo-400" />
            <span>Quality Assurance & Calibration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Moderation Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review flagged answer sheets, verify grading parity, and resolve variance anomalies before score publication.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs font-semibold flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-700 dark:text-slate-300">Live Anomaly Stream Active</span>
          </div>
        </div>
      </div>

      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Flagged for Moderation"
          value={flaggedSheets.length}
          subtitle="Awaiting quality sign-off"
          icon={ShieldAlert}
          variant="danger"
          trend={{ value: `${flaggedSheets.filter(f => f.severity === 'critical').length} Critical`, isPositive: false }}
        />
        <StatCard
          title="Resolved Today"
          value={removedSheetIds.length + 9}
          subtitle="Approved or recalibrated"
          icon={CheckCircle2}
          variant="success"
          trend={{ value: '+92% sign-off pace', isPositive: true }}
        />
        <StatCard
          title="System Variance Ratio"
          value="1.4%"
          subtitle="Target threshold < 5%"
          icon={Layers}
          variant="primary"
          trend={{ value: 'Cohort within bounds', isPositive: true }}
        />
      </div>

      {/* Live Alert List Section (Preserved Pattern) */}
      {liveAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={18} />
              <span>Live Marking Anomaly Alerts ({liveAlerts.length})</span>
            </h2>
            <span className="text-xs text-slate-400">Streamed via telemetry daemon</span>
          </div>

          <AnimatePresence>
            {liveAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-red-50/80 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-4 rounded-xl flex items-center justify-between shadow-sm gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded">
                      Sheet: {alert.sheetId}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      Examiner: {alert.examinerId}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityBadgeClass(
                        alert.severity
                      )}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                    {alert.message}
                  </p>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() => handleOpenSheet(alert.sheetId)}
                    className="py-1 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  >
                    Investigate
                  </button>
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    className="py-1 px-2.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Flagged Answer Sheets Queue Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Flagged Answer Sheets Queue</span>
              <span className="text-xs font-semibold py-0.5 px-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                {flaggedSheets.length} pending
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Double-blind and anomaly-flagged scripts requiring independent moderation sign-off.
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={flaggedSheets}
          emptyTitle="Moderation Queue is Clear"
          emptyDescription="All flagged answer scripts have been verified and processed. New anomaly alerts will appear here in real-time."
        />
      </div>
    </div>
  );
}
