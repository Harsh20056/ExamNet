import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  role: 'examiner' | 'moderator' | 'controller';
  description?: string;
  sheetId?: string;
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({ title, role, description, sheetId }) => {
  const { role: userRole } = useAuth();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 mb-2">
            <span>{role} workspace</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {sheetId && (
            <p className="text-sm font-mono text-primary-600 dark:text-primary-400 mt-1">
              Target Answer Sheet: <span className="font-bold underline">{sheetId}</span>
            </p>
          )}
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {description || 'This module is scheduled for implementation in the next phase.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium">
            Active Role: {userRole || 'none'}
          </span>
        </div>
      </div>

      <div className="p-10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-3">
          <ShieldCheck size={24} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2">
          Secure route active with verified access controls for <span className="font-semibold text-slate-700 dark:text-slate-300">{role}</span>.
        </p>
      </div>
    </div>
  );
};

// Specialized Identity Verification Page that allows passing the session check
export const ExaminerIdentityPage: React.FC = () => {
  const { setIdentityVerified, identityVerified } = useAuth();
  const navigate = useNavigate();

  const handleVerify = () => {
    setIdentityVerified(true);
    // Optionally redirect immediately to a sample marking sheet or back to dashboard
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 mb-2">
          <span>Security Protocol</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Examiner Identity Verification</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Before accessing digital answer sheets, examiners must confirm their identity for this evaluation session.
        </p>
      </div>

      <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className={`w-4 h-4 rounded-full ${identityVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Status: {identityVerified ? 'Session Identity Verified' : 'Verification Required'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {identityVerified 
                ? 'Your session identity check is active. You may mark assigned sheets.' 
                : 'Please complete or simulate the identity verification step below.'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleVerify}
            className="btn-primary py-2.5 px-5 flex items-center gap-2 text-sm font-semibold"
          >
            <ShieldCheck size={18} />
            {identityVerified ? 'Re-verify Identity Check' : 'Confirm & Pass Identity Check'}
          </button>

          {identityVerified && (
            <button
              onClick={() => navigate('/examiner/mark/sheet-demo-101')}
              className="py-2.5 px-5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <span>Go to Sample Marking Sheet</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
