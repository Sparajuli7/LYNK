interface OddsBarProps {
  ridersPct: number;
  riderCount: number;
  doubterCount: number;
}

export function OddsBar({ ridersPct, riderCount, doubterCount }: OddsBarProps) {
  const pct = Math.round(Math.min(100, Math.max(0, ridersPct)));

  return (
    <div
      role="img"
      aria-label={`${pct}% riders, ${100 - pct}% doubters`}
    >
      <div className="flex justify-between text-[9px] font-black tracking-wider mb-1">
        <span className="text-rider">RIDERS {pct}%</span>
        <span className="text-doubter">{100 - pct}% DOUBTERS</span>
      </div>
      <div className="h-1.5 rounded-sm bg-doubter relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-rider transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-text-mute mt-1">
        <span>{riderCount} riders</span>
        <span>{doubterCount} doubters</span>
      </div>
    </div>
  );
}
