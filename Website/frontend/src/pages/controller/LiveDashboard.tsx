import { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  TrendingUp, 
  BarChart3,
  Activity
} from 'lucide-react';
import { mockAlerts, mockExaminers } from '../../mock/data';
import { StatCard, ProgressBar } from '../../components/common';

export default function LiveDashboard() {
  // Fake tick counter that updates live stats every 3 seconds
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Compute live stat metrics with slight dynamic oscillation based on tick
  const stats = useMemo(() => {
    const total = 1450 + (tick % 5);
    const pending = 380 - (tick % 8);
    const inProgress = 520 + (tick % 4);
    const flagged = 42 + (tick % 3);
    const final = total - (pending + inProgress + flagged);

    return {
      total,
      pending,
      inProgress,
      flagged,
      final,
      completionRate: Math.round((final / total) * 100),
    };
  }, [tick]);

  // Subject Progress Breakdown
  const subjectProgress = useMemo(() => {
    return [
      { name: 'Computer Science (CS-402)', total: 450, done: 320 + (tick % 6), color: 'primary' as const },
      { name: 'Discrete Mathematics (MA-301)', total: 380, done: 245 + (tick % 4), color: 'emerald' as const },
      { name: 'Data Structures (CS-201)', total: 320, done: 290 + (tick % 3), color: 'indigo' as const },
      { name: 'Theory of Computation (CS-504)', total: 300, done: 165 + (tick % 5), color: 'amber' as const },
    ];
  }, [tick]);

  // Examiner Progress Breakdown
  const examinerProgress = useMemo(() => {
    return mockExaminers.map((examiner, idx) => {
      const liveEvaluated = examiner.evaluatedCount + (tick % (idx + 2));
      return {
        ...examiner,
        liveEvaluated: Math.min(examiner.assignedSheetsCount, liveEvaluated),
      };
    });
  }, [tick]);

  // Live recent alerts stream
  const recentAlerts = useMemo(() => {
    return mockAlerts.slice(0, 4);
  }, []);

  // Predicted completion calculation
  const predictedTime = useMemo(() => {
    const remainingSheets = stats.total - stats.final;
    const avgSecsPerSheet = 240; // 4 mins
    const totalExaminers = mockExaminers.length || 15;
    const remainingHours = Math.max(1, Math.round((remainingSheets * avgSecsPerSheet) / (totalExaminers * 3600)));
    return `${remainingHours}h 15m remaining (Est. 06:45 PM Today)`;
  }, [stats]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 mb-2 border border-primary-200/50 dark:border-primary-800/40">
            <Activity size={12} className="text-primary-600 dark:text-primary-400" />
            <span>Telemetry Center • Real-Time Pulse</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Controller Command Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Global evaluation throughput, examiner pacing, quality anomalies, and automated completion forecasting.
          </p>
        </div>

        {/* Live Pulse Indicator */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs font-semibold flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-700 dark:text-slate-300">
              Live Stream Active (Tick: #{tick})
            </span>
          </div>
        </div>
      </div>

      {/* 5 Core StatCards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Sheets"
          value={stats.total.toLocaleString()}
          subtitle="All active bundles"
          icon={Layers}
          variant="default"
        />

        <StatCard
          title="Pending"
          value={stats.pending}
          subtitle="Awaiting examiner pick"
          icon={Clock}
          variant="default"
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress}
          subtitle="Currently on screen"
          icon={Activity}
          variant="primary"
          trend={{ value: 'Live active', isPositive: true }}
        />

        <StatCard
          title="Flagged"
          value={stats.flagged}
          subtitle="Variance / Speed alerts"
          icon={AlertTriangle}
          variant="danger"
          trend={{ value: 'Needs review', isPositive: false }}
        />

        <StatCard
          title="Finalized"
          value={stats.final}
          subtitle={`${stats.completionRate}% completion`}
          icon={CheckCircle2}
          variant="success"
          trend={{ value: '+18/hr', isPositive: true }}
        />
      </div>

      {/* Predicted Completion Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center flex-shrink-0">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary-200">
              Algorithmic Throughput Forecast
            </div>
            <div className="text-lg font-bold">
              Predicted Cycle Completion: <span className="underline decoration-emerald-400">{predictedTime}</span>
            </div>
            <p className="text-xs text-primary-100/90 mt-0.5">
              Based on rolling 60-minute mean evaluation velocity across 4 active subject faculties.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-right">
          <div className="bg-white/10 px-4 py-2 rounded-xl text-center backdrop-blur-sm">
            <div className="text-xs text-primary-200 uppercase font-bold">Pacing Status</div>
            <div className="text-base font-extrabold text-emerald-300">ON TRACK (104%)</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Subject Progress & Examiner Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress by Subject */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-primary-600 dark:text-primary-400" />
                <span>Progress by Subject</span>
              </h2>
              <p className="text-xs text-slate-500">Subject-wise script digitisation and clearance</p>
            </div>
          </div>

          <div className="space-y-4">
            {subjectProgress.map((sub, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>{sub.name}</span>
                  <span className="font-mono text-slate-500">
                    {sub.done} / {sub.total} scripts
                  </span>
                </div>
                <ProgressBar
                  value={sub.done}
                  max={sub.total}
                  color={sub.color}
                  size="md"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Progress by Examiner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>Examiner Quota Pacing</span>
              </h2>
              <p className="text-xs text-slate-500">Individual workload clearance and current status</p>
            </div>
          </div>

          <div className="space-y-3.5">
            {examinerProgress.map((ex) => (
              <div key={ex.id} className="space-y-1 text-xs">
                <div className="flex justify-between items-center font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{ex.name}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                      ex.status === 'flagged' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}>
                      {ex.status}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500">
                    {ex.liveEvaluated} / {ex.assignedSheetsCount} ({Math.round((ex.liveEvaluated / ex.assignedSheetsCount) * 100)}%)
                  </span>
                </div>
                <ProgressBar
                  value={ex.liveEvaluated}
                  max={ex.assignedSheetsCount}
                  color={ex.status === 'flagged' ? 'rose' : 'emerald'}
                  size="sm"
                  showPercentage={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Telemetry & Anomaly Alerts Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <span>Real-Time Anomaly & Security Stream</span>
            </h2>
            <p className="text-xs text-slate-500">Automated AI parity audit and rapid-marking telemetry alerts</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {recentAlerts.map((alert) => (
            <div key={alert.id} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 font-mono">
                  <span className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/50">
                    {alert.sheetId}
                  </span>
                  <span className="text-slate-500">{alert.examinerId}</span>
                  <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    {alert.severity}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {alert.message}
                </p>
              </div>

              <div className="text-right text-slate-400 font-mono text-[11px] flex-shrink-0">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
