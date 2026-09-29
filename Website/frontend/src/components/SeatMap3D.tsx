interface SeatMap3DProps {
  onClose: () => void;
  targetRow?: number;
  targetCol?: number;
}

/**
 * SeatMap3D is deprecated in on-screen marking mode. Retained as lightweight placeholder.
 */
export default function SeatMap3D({ onClose }: SeatMap3DProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl max-w-md w-full text-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Room Layout Disabled</h3>
        <p className="text-xs text-slate-500 mb-4">Exam center layout is inactive in digital on-screen marking mode.</p>
        <button onClick={onClose} className="btn-primary py-2 px-4 text-xs">Close</button>
      </div>
    </div>
  );
}
