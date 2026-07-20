/**
 * Window/Level HUD - Shows current W/L while adjusting
 */

interface WindowLevelHUDProps {
  windowLevel: number;
  windowWidth: number;
  visible: boolean;
}

export function WindowLevelHUD({ windowLevel, windowWidth, visible }: WindowLevelHUDProps) {
  if (!visible) return null;

  return (
    <div className="absolute top-12 left-4 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 pointer-events-none">
      <div className="text-xs text-white/60 mb-0.5">Window / Level</div>
      <div className="text-sm font-medium text-white font-mono">
        {Math.round(windowWidth)} / {Math.round(windowLevel)}
      </div>
      <div className="text-[10px] text-white/40 mt-1">
        Drag left/right: contrast • up/down: brightness
      </div>
    </div>
  );
}
