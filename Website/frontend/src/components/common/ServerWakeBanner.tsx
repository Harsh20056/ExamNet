import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { subscribeServerWaking } from '../../services/api';

export const ServerWakeBanner: React.FC = () => {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    return subscribeServerWaking((waking) => {
      setIsWaking(waking);
    });
  }, []);

  if (!isWaking) return null;

  return (
    <div className="bg-amber-500/90 text-amber-950 dark:bg-amber-600/95 dark:text-amber-50 px-4 py-2.5 text-xs font-semibold flex items-center justify-center space-x-2 shadow-md animate-pulse sticky top-16 z-40 backdrop-blur-sm border-b border-amber-600/20">
      <Loader2 size={16} className="animate-spin text-amber-950 dark:text-amber-100 flex-shrink-0" />
      <span>Waking up the server, this can take up to a minute...</span>
    </div>
  );
};
