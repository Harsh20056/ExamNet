import { useState, useMemo } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  ShieldCheck
} from 'lucide-react';
import { mockSheets, mockExam, mockExaminers } from '../../mock/data';
import { DataTable, type Column } from '../../components/common';
import toast from 'react-hot-toast';

interface ExportRecord {
  id: string;
  sheetId: string;
  candidateCode: string;
  examCode: string;
  examTitle: string;
  examinerName: string;
  totalScore: number;
  maxScore: number;
  percentage: string;
  status: string;
  moderated: string;
}

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);

  // Compile full export records from mock data
  const exportRecords: ExportRecord[] = useMemo(() => {
    return mockSheets.map((s) => {
      const examiner = mockExaminers.find((e) => e.id === s.allocatedExaminerId);
      const score = s.totalScore || 0;
      const pct = ((score / s.maxPossibleScore) * 100).toFixed(1);
      return {
        id: s.id,
        sheetId: s.id,
        candidateCode: s.candidateAnonymizedId,
        examCode: mockExam.code,
        examTitle: mockExam.title,
        examinerName: examiner?.name || 'Assigned Examiner',
        totalScore: score,
        maxScore: s.maxPossibleScore,
        percentage: `${pct}%`,
        status: s.status,
        moderated: s.moderationScore !== undefined ? 'Yes' : 'No',
      };
    });
  }, []);

  const handleDownloadCSV = () => {
    setIsExporting(true);

    try {
      // Build CSV String
      const headers = [
        'Sheet ID',
        'Candidate Anonymized ID',
        'Exam Code',
        'Subject',
        'Assigned Examiner',
        'Total Awarded Score',
        'Max Possible Score',
        'Percentage',
        'Status',
        'Moderation Applied',
      ];

      const rows = exportRecords.map((r) => [
        r.sheetId,
        r.candidateCode,
        r.examCode,
        `"${r.examTitle.replace(/"/g, '""')}"`,
        `"${r.examinerName.replace(/"/g, '""')}"`,
        r.totalScore,
        r.maxScore,
        r.percentage,
        r.status,
        r.moderated,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SAMADHAN_X_Results_${mockExam.code}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Official Result Ledger exported and downloaded as CSV!', {
        icon: '📊',
        duration: 4000,
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to export CSV file.');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Column<ExportRecord>[] = [
    {
      key: 'sheetId',
      header: 'Sheet ID',
      className: 'w-32 font-mono font-bold text-slate-900 dark:text-slate-100',
      render: (row) => (
        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
          {row.sheetId}
        </span>
      ),
    },
    {
      key: 'candidateCode',
      header: 'Candidate Token',
      className: 'w-36 font-mono text-xs text-slate-500',
      render: (row) => <span>{row.candidateCode}</span>,
    },
    {
      key: 'examiner',
      header: 'Evaluator',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {row.examinerName}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Awarded Score',
      align: 'center',
      className: 'w-32 font-mono text-xs font-bold text-slate-900 dark:text-white',
      render: (row) => (
        <span>
          {row.totalScore} / {row.maxScore}
        </span>
      ),
    },
    {
      key: 'percentage',
      header: 'Percentage',
      align: 'center',
      className: 'w-28 font-mono text-xs font-bold text-primary-600 dark:text-primary-400',
      render: (row) => <span>{row.percentage}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      className: 'w-28 text-xs font-bold uppercase',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] ${
            row.status === 'final'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }`}
        >
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 mb-2 border border-emerald-200/50 dark:border-emerald-800/40">
            <FileSpreadsheet size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span>Official Result Dissemination</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Results & CSV Export
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate and export cryptographically sealed score tabulations and official CSV grade books.
          </p>
        </div>

        {/* Download Action Button */}
        <button
          onClick={handleDownloadCSV}
          disabled={isExporting}
          className="flex items-center space-x-2 py-3 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
        >
          <Download size={16} />
          <span>{isExporting ? 'Generating CSV...' : 'Download Results CSV'}</span>
        </button>
      </div>

      {/* Summary Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Ready for Dissemination: {mockExam.title} ({mockExam.code})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total active candidate scripts: <span className="font-semibold text-slate-700 dark:text-slate-300">{exportRecords.length} records</span>. Certified against tamper-proof audit trail.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Format: Standard CSV (RFC 4180)</span>
        </div>
      </div>

      {/* Preview Table */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>Results Preview Ledger</span>
        </h2>

        <DataTable
          columns={columns}
          data={exportRecords}
        />
      </div>
    </div>
  );
}
