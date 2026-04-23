interface ShameTileProps {
  thumbnailUrl?: string;
  daysAgo: number;
  punishmentTitle: string;
  lostBetTitle: string;
  onClick?: () => void;
}

export function ShameTile({
  thumbnailUrl,
  daysAgo,
  punishmentTitle,
  lostBetTitle,
  onClick,
}: ShameTileProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-start gap-3 text-left"
    >
      {/* Left: thumbnail */}
      <div className="w-[72px] h-[72px] rounded-lg bg-surface-2 border-[1.5px] border-doubter/30 flex-shrink-0 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          /* Placeholder bars */
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-3">
            <div className="w-full h-1 bg-doubter/20 rounded-full" />
            <div className="w-3/4 h-1 bg-doubter/20 rounded-full" />
            <div className="w-1/2 h-1 bg-doubter/20 rounded-full" />
          </div>
        )}
      </div>

      {/* Right: text content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="font-mono text-[10px] text-doubter tracking-wider">
          FORFEIT · {daysAgo} DAYS AGO
        </div>
        <div className="font-bold text-[14px] text-text mt-1 truncate">
          {punishmentTitle}
        </div>
        <div className="text-[12px] text-text-mute mt-0.5 truncate">
          Lost: {lostBetTitle}
        </div>
      </div>
    </button>
  );
}
