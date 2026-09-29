import { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  ShieldAlert
} from 'lucide-react';
import { mockAlerts, mockExaminers } from '../../mock/data';
import { DataTable, type Column } from '../../components/common';
import type { Alert } from '../../types';
import toast from 'react-hot-toast';

interface ManagedAlert extends Alert {
  examinerName: string;
  resolutionNote?: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<ManagedAlert[]>(() => {
    return mockAlerts.map((a) => {
      const examiner = mockExaminers.find((e) => e.id === a.examinerId);
      return {
        ...a,
        examinerName: examiner?.name || 'Allocated Examiner',
      };
    });
  });

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Resolve dialog state
  const [resolvingAlert, setResolvingAlert] = useState<ManagedAlert | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [noteError, setNoteError] = useState<string>('');

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (statusFilter === 'active' && a.resolved) return false;
      if (statusFilter === 'resolved' && !a.resolved) return false;
      return true;
    });
  }, [alerts, typeFilter, severityFilter, statusFilter]);

  const handleOpenResolve = (alert: ManagedAlert) => {
    setResolvingAlert(alert);
    setResolutionNote('');
    setNoteError('');
  };

  const handleConfirmResolve = () => {
    if (!resolvingAlert) return;
    if (!resolutionNote.trim()) {
      setNoteError('A resolution audit note is required.');
      return;
    }

    setAlerts((prev) =>
      prev.map((a) =>
        a.id === resolvingAlert.id
          ? { ...a, resolved: true, resolutionNote: resolutionNote.trim() }
          : a
      )
    );

    toast.success(`Alert ${resolvingAlert.id} resolved and recorded in audit log.`, {
      icon: '✅',
    });

    setResolvingAlert(null);
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

  const columns: Column<ManagedAlert>[] = [
    {
      key: 'sheetId',
      header: 'Sheet & Alert ID',
      className: 'w-40 font-mono text-xs',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-white block">{row.sheetId}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.id}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Anomaly Type',
      className: 'w-36 text-xs font-semibold capitalize text-slate-700 dark:text-slate-300',
      render: (row) => row.type.replace('_', ' '),
    },
    {
      key: 'severity',
      header: 'Severity',
      align: 'center',
      className: 'w-28',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${severityBadgeClass(
            row.severity
          )}`}
        >
          {row.severity}
        </span>
      ),
    },
    {
      key: 'message',
      header: 'Incident Description',
      render: (row) => (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{row.message}</p>
          <div className="text-[11px] text-slate-400">
            Examiner: <span className="font-semibold text-slate-600 dark:text-slate-300">{row.examinerName}</span>
          </div>
          {row.resolutionNote && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 p-1.5 rounded text-[11px] font-mono border border-emerald-200 dark:border-emerald-800/40">
              Resolved: {row.resolutionNote}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      className: 'w-28',
      render: (row) =>
        row.resolved ? (
          <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <CheckCircle2 size={13} />
            <span>Resolved</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs font-bold">
            <AlertTriangle size={13} />
            <span>Active</span>
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      className: 'w-28',
      render: (row) =>
        row.resolved ? (
          <span className="text-xs text-slate-400 font-mono">Closed</span>
        ) : (
          <button
            onClick={() => handleOpenResolve(row)}
            className="py-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            Resolve
          </button>
        ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 mb-2 border border-red-200/50 dark:border-red-800/40">
            <ShieldAlert size={12} className="text-red-600 dark:text-red-400" />
            <span>Integrity Guard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Security & Anomaly Alerts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time feed of automated score spikes, rapid evaluation triggers, and rubric non-conformance events.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <div className="flex items-center space-x-2">
          <Filter size={14} className="text-slate-400" />
          <span>Filters:</span>
        </div>

        {/* Severity */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
        >
          <option value="all">All Types</option>
          <option value="speed_violation">Speed Violation</option>
          <option value="variance_spike">Variance Spike</option>
          <option value="rubric_deviation">Rubric Deviation</option>
          <option value="duplicate_pattern">Duplicate Pattern</option>
          <option value="unusual_time">Unusual Time</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="resolved">Resolved Only</option>
        </select>

        <span className="text-slate-400 ml-auto font-mono text-[11px]">
          Showing {filteredAlerts.length} alerts
        </span>
      </div>

      {/* Main Alerts Table */}
      <DataTable
        columns={columns}
        data={filteredAlerts}
        emptyTitle="No Alerts Found"
        emptyDescription="No anomalies match your active filter settings."
      />

      {/* Resolve Dialog Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <span>Resolve Anomaly Alert: {resolvingAlert.id}</span>
            </h3>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
              <div className="font-mono text-slate-500">Sheet ID: {resolvingAlert.sheetId}</div>
              <div className="text-slate-800 dark:text-slate-200 font-medium">{resolvingAlert.message}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Resolution Investigation Note (Mandatory)
              </label>
              <textarea
                rows={3}
                required
                value={resolutionNote}
                onChange={(e) => {
                  setResolutionNote(e.target.value);
                  if (noteError) setNoteError('');
                }}
                placeholder="Detail verification steps, phone confirmation, or second-evaluator sign-off..."
                className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-primary-500"
              />
              {noteError && (
                <p className="text-xs text-red-500 font-medium">{noteError}</p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                Mark Resolved & Save Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
