import { useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  BarChart2
} from 'lucide-react';
import { DataTable, type Column } from '../../components/common';

interface ExaminerRow {
  id: string;
  name: string;
  subject: string;
  avgTime: string;
  sheetsPerDay: number;
  avgMarks: number;
  deviation: number; // Deviation from peer cohort mean %
  overrideRate: string;
  calibrationScore: string;
  flagCount: number;
}

export default function ExaminerAnalytics() {
  const examinerRows: ExaminerRow[] = useMemo(() => {
    return [
      {
        id: 'ex-101',
        name: 'Dr. Sunita Deshmukh',
        subject: 'Algorithms & Discrete Math',
        avgTime: '4m 48s',
        sheetsPerDay: 28,
        avgMarks: 52.4,
        deviation: +1.2,
        overrideRate: '8.4%',
        calibrationScore: '98.5%',
        flagCount: 0,
      },
      {
        id: 'ex-102',
        name: 'Prof. Ramesh K. Tiwari',
        subject: 'Algorithms & Data Structures',
        avgTime: '1m 54s',
        sheetsPerDay: 48,
        avgMarks: 64.2,
        deviation: +18.6, // High positive deviation
        overrideRate: '34.2%',
        calibrationScore: '74.0%',
        flagCount: 3,
      },
      {
        id: 'ex-103',
        name: 'Dr. Anandita Sen',
        subject: 'Computer Science & Engineering',
        avgTime: '5m 24s',
        sheetsPerDay: 22,
        avgMarks: 49.8,
        deviation: -2.4,
        overrideRate: '11.0%',
        calibrationScore: '96.2%',
        flagCount: 0,
      },
      {
        id: 'ex-104',
        name: 'Er. Mohammed Zafar',
        subject: 'Theory of Computation',
        avgTime: '3m 54s',
        sheetsPerDay: 32,
        avgMarks: 51.0,
        deviation: -0.8,
        overrideRate: '14.5%',
        calibrationScore: '94.8%',
        flagCount: 1,
      },
      {
        id: 'ex-105',
        name: 'Dr. Priya V. Nambiar',
        subject: 'Data Structures & Algorithms',
        avgTime: '6m 06s',
        sheetsPerDay: 18,
        avgMarks: 41.5,
        deviation: -16.2, // High negative deviation
        overrideRate: '22.0%',
        calibrationScore: '88.0%',
        flagCount: 2,
      },
    ];
  }, []);

  const columns: Column<ExaminerRow>[] = [
    {
      key: 'name',
      header: 'Examiner & Discipline',
      className: 'w-60',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            {row.name}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {row.subject} ({row.id})
          </div>
        </div>
      ),
    },
    {
      key: 'avgTime',
      header: 'Avg Time / Script',
      className: 'w-32',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          {row.avgTime}
        </span>
      ),
    },
    {
      key: 'sheetsPerDay',
      header: 'Daily Pacing',
      align: 'center',
      className: 'w-28',
      render: (row) => (
        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
          {row.sheetsPerDay} / day
        </span>
      ),
    },
    {
      key: 'avgMarks',
      header: 'Mean Score',
      align: 'center',
      className: 'w-24',
      render: (row) => (
        <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
          {row.avgMarks}
        </span>
      ),
    },
    {
      key: 'deviation',
      header: 'Peer Deviation',
      align: 'center',
      className: 'w-32',
      render: (row) => {
        const isAnomaly = Math.abs(row.deviation) >= 15;
        return (
          <span
            className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded ${
              isAnomaly
                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {row.deviation > 0 ? `+${row.deviation}%` : `${row.deviation}%`}
          </span>
        );
      },
    },
    {
      key: 'overrideRate',
      header: 'AI Override',
      align: 'center',
      className: 'w-28',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
          {row.overrideRate}
        </span>
      ),
    },
    {
      key: 'calibrationScore',
      header: 'Benchmark Parity',
      align: 'center',
      className: 'w-32',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {row.calibrationScore}
        </span>
      ),
    },
    {
      key: 'flagCount',
      header: 'Flags',
      align: 'center',
      className: 'w-20',
      render: (row) => (
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            row.flagCount > 0
              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
          }`}
        >
          {row.flagCount}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 mb-2 border border-primary-200/50 dark:border-primary-800/40">
            <BarChart2 size={12} className="text-primary-600 dark:text-primary-400" />
            <span>Faculty Quality Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Examiner Analytics & Deviation Matrix
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Detect grading bias, benchmark conformity, pace variance, and individual AI override tendencies across examiners.
          </p>
        </div>
      </div>

      {/* Visual Peer Deviation Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-600" />
              <span>Deviation from Peer Mean Curve (DeviationChart)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Acceptable calibration variance threshold: ±10%. Bars beyond this boundary indicate lenient or severe grading tendencies.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {examinerRows.map((ex) => {
            const isSevere = ex.deviation < -10;
            const isLenient = ex.deviation > 10;
            const absWidth = Math.min(100, Math.abs(ex.deviation) * 3);

            return (
              <div key={ex.id} className="space-y-1 text-xs">
                <div className="flex justify-between items-center font-medium">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{ex.name}</span>
                  <span
                    className={`font-mono font-bold ${
                      isLenient ? 'text-amber-600' : isSevere ? 'text-red-500' : 'text-emerald-600'
                    }`}
                  >
                    {ex.deviation > 0 ? `+${ex.deviation}% (Lenient)` : ex.deviation < 0 ? `${ex.deviation}% (Severe)` : '0% (Standard)'}
                  </span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex items-center">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isLenient
                        ? 'bg-amber-500'
                        : isSevere
                        ? 'bg-red-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(8, absWidth)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Analytics Data Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users size={18} className="text-primary-600" />
          <span>Examiner Performance Roster</span>
        </h2>

        <DataTable
          columns={columns}
          data={examinerRows}
        />
      </div>
    </div>
  );
}
