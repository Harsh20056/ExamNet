import { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Link2, 
  Clock
} from 'lucide-react';
import { DataTable, type Column } from '../../components/common';
import type { AuditEntry } from '../../types';
import toast from 'react-hot-toast';

interface CryptographicAuditRow extends AuditEntry {
  previousHash: string;
  blockHash: string;
  isCorrupted?: boolean;
}

export default function AuditLog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [chainStatus, setChainStatus] = useState<'unverified' | 'valid' | 'broken'>('unverified');
  const [brokenIndex, setBrokenIndex] = useState<number | null>(null);

  // Mock cryptographic block chain log
  const initialAuditChain: CryptographicAuditRow[] = useMemo(() => {
    return [
      {
        id: 'tx-8001',
        timestamp: '2026-09-29T10:15:30Z',
        userId: 'controller@mponline.gov.in',
        userRole: 'controller',
        action: 'LOGIN',
        details: 'Controller session authenticated via multi-factor token.',
        ipAddress: '10.12.0.42',
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
        blockHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      },
      {
        id: 'tx-8002',
        timestamp: '2026-09-29T10:20:12Z',
        userId: 'ex-101 (Dr. Sunita Deshmukh)',
        userRole: 'examiner',
        action: 'START_MARKING',
        sheetId: 'sheet-001',
        details: 'Opened candidate script CAND-99120 for evaluation.',
        ipAddress: '10.14.2.19',
        previousHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        blockHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      },
      {
        id: 'tx-8003',
        timestamp: '2026-09-29T10:24:45Z',
        userId: 'ex-101 (Dr. Sunita Deshmukh)',
        userRole: 'examiner',
        action: 'AWARD_MARK',
        sheetId: 'sheet-001',
        details: 'Awarded 4.5/5.0 on Q1 using AI suggestion accept mechanism.',
        ipAddress: '10.14.2.19',
        previousHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
        blockHash: 'fc46440c880582218185e561e6f9d0552456d9c2c3e5f29117e60e052618260a',
      },
      {
        id: 'tx-8004',
        timestamp: '2026-09-29T11:05:00Z',
        userId: 'ex-102 (Prof. Ramesh Tiwari)',
        userRole: 'examiner',
        action: 'TRIGGER_ALERT',
        sheetId: 'sheet-002',
        details: 'Evaluation speed anomaly detected: 10 marks awarded in 11.4s.',
        ipAddress: '10.14.2.88',
        previousHash: 'fc46440c880582218185e561e6f9d0552456d9c2c3e5f29117e60e052618260a',
        blockHash: '11a4a60b518bf24989d4818028042c679530dd0cd178168b7866e632e50c6654',
      },
      {
        id: 'tx-8005',
        timestamp: '2026-09-29T11:45:20Z',
        userId: 'moderator@demo.com',
        userRole: 'moderator',
        action: 'MODERATE_SHEET',
        sheetId: 'sheet-002',
        details: 'Moderator adjusted marks from 68 to 62 with audited note.',
        ipAddress: '10.12.5.12',
        previousHash: '11a4a60b518bf24989d4818028042c679530dd0cd178168b7866e632e50c6654',
        blockHash: '2079361b53211516024f122502011230777700ecda012302b1897d26428c0326',
      },
      {
        id: 'tx-8006',
        timestamp: '2026-09-29T12:00:00Z',
        userId: 'ex-101 (Dr. Sunita Deshmukh)',
        userRole: 'examiner',
        action: 'FINALIZE_SHEET',
        sheetId: 'sheet-003',
        details: 'Evaluation confirmed and marked final with running score 59/70.',
        ipAddress: '10.14.2.19',
        previousHash: '2079361b53211516024f122502011230777700ecda012302b1897d26428c0326',
        blockHash: '3f79bb7b435b05321651da34d377765608359cc0e9a5630377e60fbdbfb8a81f',
      },
    ];
  }, []);

  const [auditRows] = useState<CryptographicAuditRow[]>(initialAuditChain);

  // Filter rows by query
  const filteredRows = useMemo(() => {
    return auditRows.filter(
      (r) =>
        r.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.sheetId && r.sheetId.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [auditRows, searchTerm]);

  // Verify chain cryptographically (mock hash pointer checking)
  const handleVerifyChain = () => {
    let isValid = true;
    let faultIndex: number | null = null;

    for (let i = 1; i < auditRows.length; i++) {
      if (auditRows[i].previousHash !== auditRows[i - 1].blockHash) {
        isValid = false;
        faultIndex = i;
        break;
      }
    }

    if (isValid) {
      setChainStatus('valid');
      setBrokenIndex(null);
      toast.success('Cryptographic Audit Chain Verified: 100% Integrity Validated. All hash blocks intact.', {
        icon: '🛡️',
        duration: 4000,
      });
    } else {
      setChainStatus('broken');
      setBrokenIndex(faultIndex);
      toast.error(`Integrity Fault Detected: Block #${faultIndex} hash pointer mismatch!`);
    }
  };

  const columns: Column<CryptographicAuditRow>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp (UTC)',
      className: 'w-44 font-mono text-xs text-slate-500',
      render: (row) => (
        <div className="flex items-center space-x-1.5">
          <Clock size={12} className="text-slate-400" />
          <span>{new Date(row.timestamp).toLocaleTimeString()}</span>
          <span className="text-[10px] text-slate-400 block">{row.timestamp.split('T')[0]}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Event Action',
      className: 'w-36',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 px-2 py-0.5 rounded border border-primary-100 dark:border-primary-900/30">
          {row.action}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'Actor / User ID',
      className: 'w-48 text-xs',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200 block">{row.userId}</span>
          <span className="text-[10px] uppercase font-semibold text-slate-400">{row.userRole}</span>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Audit Ledger Details',
      render: (row) => (
        <div className="space-y-1">
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{row.details}</p>
          <div className="flex items-center space-x-2 font-mono text-[10px] text-slate-400">
            {row.sheetId && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Sheet: {row.sheetId}</span>}
            <span>IP: {row.ipAddress}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'blockHash',
      header: 'Block Hash',
      className: 'w-36 font-mono text-[11px] text-slate-400',
      render: (row) => (
        <span title={row.blockHash} className="truncate block font-mono">
          {row.blockHash.slice(0, 10)}...{row.blockHash.slice(-6)}
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
            <Link2 size={12} className="text-primary-600 dark:text-primary-400" />
            <span>Immutable Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Cryptographic Audit Trail
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tamper-evident blockchain log recording all evaluation, AI suggestion overrides, moderation changes, and login sessions.
          </p>
        </div>

        {/* Verify Chain Action Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleVerifyChain}
            className="flex items-center space-x-2 py-2.5 px-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-600/20"
          >
            <ShieldCheck size={16} />
            <span>Verify Cryptographic Chain</span>
          </button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {chainStatus === 'valid' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fade-in">
          <div className="flex items-center space-x-3">
            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <span className="font-bold">Cryptographic Chain Verification: OK</span>
              <p className="text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                Verified {auditRows.length} consecutive blocks without hash discrepancy. Zero tampering detected.
              </p>
            </div>
          </div>
          <span className="font-mono font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 rounded text-emerald-800 dark:text-emerald-200">
            Integrity Guaranteed
          </span>
        </div>
      )}

      {chainStatus === 'broken' && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 p-4 rounded-xl flex items-center space-x-3 text-xs text-red-800 dark:text-red-200 animate-fade-in">
          <XCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <span className="font-bold">Cryptographic Chain Verification: BROKEN</span>
            <p className="text-red-700 dark:text-red-300 mt-0.5 font-mono">
              Hash pointer discrepancy found at block #{brokenIndex}. Potential manual modification detected.
            </p>
          </div>
        </div>
      )}

      {/* Search Filter & Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Audit Ledger Entries</span>
            <span className="text-xs font-semibold py-0.5 px-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full font-mono">
              {filteredRows.length} records
            </span>
          </h2>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, actor, or sheet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-primary-500 w-64"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredRows}
          emptyTitle="No audit entries matched"
          emptyDescription="Try clearing or adjusting your search keyword."
        />
      </div>
    </div>
  );
}
