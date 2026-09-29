import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mockSheets, mockExam } from '../../mock/data';
import type { Sheet } from '../../types';
import { StatCard, StatusBadge, DataTable, type Column } from '../../components/common';
import { 
  FileCheck2, 
  Clock, 
  SlidersHorizontal, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface AssignedSheetRow {
  id: string;
  sheetId: string;
  subject: string;
  candidateCode: string;
  status: Sheet['status'];
  dueDate: string;
  rawSheet: Sheet;
}

export default function ExaminerHome() {
  const navigate = useNavigate();
  const { identityVerified, user } = useAuth();

  // Dynamic sheets for the current examiner (fallback to mock set)
  const assignedRows: AssignedSheetRow[] = useMemo(() => {
    // Map existing mockSheets into examiner row data
    return mockSheets.map((sheet, index) => {
      // Offset due dates slightly for realism
      const sheetDue = new Date(Date.now() + (index + 1) * 24 * 3600 * 1000);
      return {
        id: sheet.id,
        sheetId: sheet.id,
        subject: mockExam.title,
        candidateCode: sheet.candidateAnonymizedId,
        status: sheet.status,
        dueDate: sheetDue.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        rawSheet: sheet,
      };
    });
  }, []);

  // Compute stat card metrics
  const stats = useMemo(() => {
    const completedCount = assignedRows.filter(r => r.status === 'final').length;
    return {
      doneToday: completedCount > 0 ? `${completedCount + 14} / 25` : '18 / 25',
      avgTimePerSheet: '4m 12s',
      overrideRate: '12.4%',
    };
  }, [assignedRows]);

  const handleStartContinue = (sheetId: string) => {
    if (!identityVerified) {
      navigate('/examiner/identity', { state: { returnTo: `/examiner/mark/${sheetId}` } });
    } else {
      navigate(`/examiner/mark/${sheetId}`);
    }
  };

  const columns: Column<AssignedSheetRow>[] = [
    {
      key: 'sheetId',
      header: 'Sheet ID',
      className: 'w-44 font-mono font-bold text-slate-900 dark:text-slate-100',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs">
            {row.sheetId}
          </span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject & Code',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {row.subject}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {mockExam.code} • Max {mockExam.totalMarks} Marks
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => (
        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Clock size={13} className="text-slate-400" />
          <span>{row.dueDate}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => {
        const isStarted = row.status === 'in progress';
        const isCompleted = row.status === 'final';
        return (
          <button
            onClick={() => handleStartContinue(row.sheetId)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
              isCompleted
                ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                : isStarted
                ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
            }`}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 size={13} />
                <span>Review</span>
              </>
            ) : isStarted ? (
              <>
                <Play size={13} />
                <span>Continue</span>
              </>
            ) : (
              <>
                <ArrowRight size={13} />
                <span>Start</span>
              </>
            )}
          </button>
        );
      },
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Top Banner with Identity Status & Examiner Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 mb-2 border border-primary-200/50 dark:border-primary-800/40">
            <Sparkles size={12} className="text-primary-600 dark:text-primary-400" />
            <span>Digital Evaluation Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Examiner Workspace
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Logged in as <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.email || 'examiner@demo.com'}</span>. Review and score your assigned answer sheets.
          </p>
        </div>

        {/* Identity Verification Alert Tag */}
        <div className="flex items-center gap-3">
          {identityVerified ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs font-semibold">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Identity Verified (Session Active)</span>
            </div>
          ) : (
            <button
              onClick={() => navigate('/examiner/identity')}
              className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-800/50 text-xs font-semibold transition-colors"
            >
              <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />
              <span>Identity Verification Pending &rarr;</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Metric StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Done Today"
          value={stats.doneToday}
          subtitle="Target quota: 25 scripts"
          icon={FileCheck2}
          variant="success"
          trend={{ value: '+4 vs yesterday', isPositive: true }}
        />

        <StatCard
          title="Avg Time Per Sheet"
          value={stats.avgTimePerSheet}
          subtitle="Calibration standard: 4m - 7m"
          icon={Clock}
          variant="primary"
          trend={{ value: 'Optimal pacing', isPositive: true }}
        />

        <StatCard
          title="AI Override Rate"
          value={stats.overrideRate}
          subtitle="Audited AI adjustment variance"
          icon={SlidersHorizontal}
          variant="warning"
          trend={{ value: 'Within 15% threshold', isPositive: true }}
        />
      </div>

      {/* Assigned Answer Sheets Table Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Assigned Answer Sheets</span>
              <span className="text-xs font-semibold py-0.5 px-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                {assignedRows.length} total
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an answer script to launch the on-screen marking workspace.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500">Filter:</span>
            <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300">
              All ({assignedRows.length})
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={assignedRows}
          emptyTitle="No assigned answer sheets"
          emptyDescription="You have no pending answer sheets assigned for evaluation in this session."
        />
      </div>
    </div>
  );
}
