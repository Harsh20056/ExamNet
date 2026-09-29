import React, { useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

interface SheetViewerProps {
  pageImages: string[];
  currentPage: number; // 1-indexed
  onPageChange: (newPage: number) => void;
  className?: string;
}

export const SheetViewer: React.FC<SheetViewerProps> = ({
  pageImages,
  currentPage,
  onPageChange,
  className = '',
}) => {
  const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null);
  const totalPages = pageImages.length;
  const currentImage = pageImages[currentPage - 1] || '';

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      transformComponentRef.current?.resetTransform();
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      transformComponentRef.current?.resetTransform();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative select-none ${className}`}>
      {/* Viewer Floating Controls Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-lg flex items-center space-x-2 text-slate-200">
        <button
          onClick={handlePrev}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft size={18} />
        </button>

        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next Page (Right Arrow)"
        >
          <ChevronRight size={18} />
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1"></div>

        <button
          onClick={() => transformComponentRef.current?.zoomIn()}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>

        <button
          onClick={() => transformComponentRef.current?.zoomOut()}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>

        <button
          onClick={() => transformComponentRef.current?.resetTransform()}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Reset Fit to Screen"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Main Pan-Zoom Area */}
      <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing">
        <TransformWrapper
          ref={transformComponentRef}
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
        >
          <TransformComponent
            wrapperClass="!w-full !h-full flex items-center justify-center"
            contentClass="!w-full !h-full flex items-center justify-center p-6"
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={`Script Page ${currentPage}`}
                className="max-h-[82vh] w-auto object-contain rounded-lg shadow-2xl bg-white border border-slate-300"
                draggable={false}
              />
            ) : (
              <div className="text-slate-500 text-sm">No page image available</div>
            )}
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Bottom Mini Indicator */}
      <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-slate-400 font-mono border border-slate-800">
        <Maximize2 size={12} />
        <span>Pan & Scroll Wheel enabled</span>
      </div>
    </div>
  );
};
