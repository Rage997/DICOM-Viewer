/**
 * Slice navigation controls overlay
 * Shows slice counter and slider at bottom of viewport
 */

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SliceControlsProps {
  currentSlice: number;
  totalSlices: number;
  onSliceChange: (slice: number) => void;
}

export function SliceControls({ currentSlice, totalSlices, onSliceChange }: SliceControlsProps) {
  const [_isDragging, setIsDragging] = useState(false);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSliceChange(parseInt(e.target.value));
  };

  const handlePrevSlice = () => {
    if (currentSlice > 0) {
      onSliceChange(currentSlice - 1);
    }
  };

  const handleNextSlice = () => {
    if (currentSlice < totalSlices - 1) {
      onSliceChange(currentSlice + 1);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  if (totalSlices <= 1) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent px-4 pb-3 pt-8">
      <div className="flex items-center gap-3">
        {/* Slice counter */}
        <div className="text-xs font-medium text-white/90 min-w-[80px]">
          Slice {currentSlice + 1} / {totalSlices}
        </div>

        {/* Previous button */}
        <button
          onClick={handlePrevSlice}
          disabled={currentSlice === 0}
          className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous slice (scroll up)"
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>

        {/* Slider */}
        <div className="flex-1 relative">
          <input
            type="range"
            min={0}
            max={totalSlices - 1}
            value={currentSlice}
            onChange={handleSliderChange}
            onMouseDown={() => setIsDragging(true)}
            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right,
                rgb(59, 130, 246) 0%,
                rgb(59, 130, 246) ${(currentSlice / (totalSlices - 1)) * 100}%,
                rgba(255,255,255,0.2) ${(currentSlice / (totalSlices - 1)) * 100}%,
                rgba(255,255,255,0.2) 100%)`
            }}
          />
        </div>

        {/* Next button */}
        <button
          onClick={handleNextSlice}
          disabled={currentSlice === totalSlices - 1}
          className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next slice (scroll down)"
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}
