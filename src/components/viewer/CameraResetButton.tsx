import { RotateCcw } from 'lucide-react';

interface CameraResetButtonProps {
  onClick: () => void;
}

export function CameraResetButton({ onClick }: CameraResetButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute right-4 top-12 z-10 flex items-center gap-2 rounded-lg bg-neutral-900/90 px-3 py-2 text-xs text-neutral-300 backdrop-blur-sm transition-colors hover:bg-neutral-800/90"
      title="Reset Camera View"
    >
      <RotateCcw className="h-4 w-4" />
      Reset View
    </button>
  );
}
