import { useState, useMemo } from 'react';
import { 
  UploadCloud, 
  Users, 
  ToggleLeft, 
  ToggleRight, 
  Search, 
  Layers, 
  Sparkles
} from 'lucide-react';
import { mockSheets, mockExaminers } from '../../mock/data';
import { DataTable, StatusBadge, type Column } from '../../components/common';
import type { Sheet } from '../../types';
import toast from 'react-hot-toast';

interface ManagedSheetRow {
  id: string;
  sheetId: string;
  candidateCode: string;
  allocatedExaminerName: string;
  status: Sheet['status'];
  isCalibration: boolean;
  pageCount: number;
}

export default function SheetsManager() {
  const [sheetsList, setSheetsList] = useState<ManagedSheetRow[]>(() => {
    return mockSheets.map((s, idx) => {
      const examiner = mockExaminers.find((e) => e.id === s.allocatedExaminerId);
      return {
        id: s.id,
        sheetId: s.id,
        candidateCode: s.candidateAnonymizedId,
        allocatedExaminerName: examiner?.name || 'Unassigned',
        status: s.status,
        isCalibration: idx % 3 === 0, // Calibration seed
        pageCount: s.pageImages.length || 4,
      };
    });
  });

  const [questionWiseMode, setQuestionWiseMode] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 1. Upload mock ZIP / PDF bundles
  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      setTimeout(() => {
        setIsUploading(false);
        const newCount = 5;
        const newRows: ManagedSheetRow[] = Array.from({ length: newCount }).map((_, i) => {
          const randId = Math.floor(100 + Math.random() * 900);
          return {
            id: `sheet-${Date.now()}-${i}`,
            sheetId: `sheet-${randId}`,
            candidateCode: `CAND-${Date.now().toString().slice(-5)}`,
            allocatedExaminerName: 'Unassigned',
            status: 'pending',
            isCalibration: false,
            pageCount: 4,
          };
        });
        setSheetsList((prev) => [...newRows, ...prev]);
        toast.success(`Successfully digitised and ingested ${newCount} scanned answer sheets with anonymised IDs!`);
      }, 1500);
    }
  };

  // 2. Assign by workload
  const handleAssignByWorkload = () => {
    const unassignedCount = sheetsList.filter((s) => s.allocatedExaminerName === 'Unassigned').length;
    if (unassignedCount === 0) {
      toast.error('All sheets are already allocated to examiners.');
      return;
    }

    setSheetsList((prev) => {
      let exIdx = 0;
      return prev.map((s) => {
        if (s.allocatedExaminerName === 'Unassigned') {
          const examiner = mockExaminers[exIdx % mockExaminers.length];
          exIdx++;
          return {
            ...s,
            allocatedExaminerName: examiner.name,
            status: 'pending',
          };
        }
        return s;
      });
    });

    toast.success(`Balanced distribution: Allocated ${unassignedCount} answer sheets across ${mockExaminers.length} active examiners by workload.`, {
      icon: '⚖️',
    });
  };

  // 3. Toggle Calibration
  const handleToggleCalibration = (sheetId: string) => {
    setSheetsList((prev) =>
      prev.map((s) => (s.id === sheetId ? { ...s, isCalibration: !s.isCalibration } : s))
    );
  };

  const filteredSheets = useMemo(() => {
    return sheetsList.filter(
      (s) =>
        s.sheetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.candidateCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.allocatedExaminerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sheetsList, searchTerm]);

  const columns: Column<ManagedSheetRow>[] = [
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
      header: 'Anonymised Candidate ID',
      className: 'w-44 font-mono text-xs text-slate-500',
      render: (row) => <span>{row.candidateCode}</span>,
    },
    {
      key: 'examiner',
      header: 'Assigned Examiner',
      render: (row) => (
        <span
          className={`text-xs font-semibold ${
            row.allocatedExaminerName === 'Unassigned'
              ? 'text-amber-600 dark:text-amber-400 italic'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          {row.allocatedExaminerName}
        </span>
      ),
    },
    {
      key: 'pages',
      header: 'Pages',
      align: 'center',
      className: 'w-20',
      render: (row) => <span className="text-xs text-slate-500">{row.pageCount} pgs</span>,
    },
    {
      key: 'status',
      header: 'Marking Status',
      align: 'center',
      className: 'w-32',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'calibration',
      header: 'Benchmark Calibration',
      align: 'center',
      className: 'w-36',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleToggleCalibration(row.id)}
          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
            row.isCalibration
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <Sparkles size={11} />
          <span>{row.isCalibration ? 'Calibration Script' : 'Standard Script'}</span>
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 mb-2 border border-primary-200/50 dark:border-primary-800/40">
            <Layers size={12} className="text-primary-600 dark:text-primary-400" />
            <span>Digital Script Repository</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Answer Sheet Manager
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ingest scanned bundles, generate cryptographic anonymised IDs, allocate workload, and manage calibration scripts.
          </p>
        </div>

        {/* Global Action Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Question-wise Mode Toggle */}
          <button
            onClick={() => setQuestionWiseMode(!questionWiseMode)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
              questionWiseMode
                ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
          >
            {questionWiseMode ? (
              <ToggleRight size={20} className="text-primary-600" />
            ) : (
              <ToggleLeft size={20} className="text-slate-400" />
            )}
            <span>Question-Wise Mode: {questionWiseMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Workload Allocation Button */}
          <button
            onClick={handleAssignByWorkload}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-indigo-600/20"
          >
            <Users size={15} />
            <span>Assign by Workload</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-2xl p-8 text-center transition-all">
        <input
          type="file"
          id="sheet-upload"
          className="hidden"
          multiple
          accept=".pdf,.zip,.png,.jpg"
          onChange={handleSimulateUpload}
        />
        <label htmlFor="sheet-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-1">
            <UploadCloud size={24} />
          </div>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {isUploading ? 'Ingesting Scanned Script Bundle...' : 'Click to Upload Answer Sheet Scans (PDF / ZIP)'}
          </span>
          <span className="text-xs text-slate-500 max-w-sm">
            Automatic OCR page-splitting and candidate anonymization is performed instantly on ingestion.
          </span>
        </label>
      </div>

      {/* Status Table & Search Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Script Inventory</span>
              <span className="text-xs font-semibold py-0.5 px-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                {filteredSheets.length} scripts
              </span>
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Sheet or Examiner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-primary-500 w-60"
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredSheets}
          emptyTitle="No answer sheets matched"
          emptyDescription="Try modifying your search criteria or upload a new bundle above."
        />
      </div>
    </div>
  );
}
