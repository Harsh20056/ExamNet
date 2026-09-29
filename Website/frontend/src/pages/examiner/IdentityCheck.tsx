import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import IdentityCheck from '../../components/ProctoringSetup';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function IdentityCheckPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setIdentityVerified, user } = useAuth();

  // Location state can supply a target return url (e.g. /examiner/mark/:sheetId)
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/examiner';

  const handleSuccess = () => {
    setIdentityVerified(true);
    toast.success('Identity verified! Authorized for marking session.', {
      duration: 3500,
      icon: '🛡️',
    });
    navigate(returnTo);
  };

  const handleCancel = () => {
    navigate('/examiner');
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col justify-center items-center p-4 sm:p-6 animate-fade-in">
      <div className="w-full max-w-xl mb-4 flex items-center justify-between">
        <button
          onClick={handleCancel}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Examiner Queue</span>
        </button>

        <div className="inline-flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Biometric Session Gate</span>
        </div>
      </div>

      <IdentityCheck
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        examinerEmail={user?.email || 'examiner@demo.com'}
        examinerName={user?.displayName || 'Authorized Examiner'}
      />
    </div>
  );
}
