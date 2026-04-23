interface FolderTabProps {
  emoji: string;
  name: string;
  betCount: number;
  totalDisplay: string;
  variant: "active" | "inactive" | "new";
  onClick: () => void;
}

const TAB_COLORS = {
  active: "bg-rider",
  inactive: "bg-[#444]",
  new: "bg-transparent border border-dashed border-text-mute",
} as const;

export function FolderTab({
  emoji,
  name,
  betCount,
  totalDisplay,
  variant,
  onClick,
}: FolderTabProps) {
  return (
    <button onClick={onClick} className="text-left w-full">
      {/* Tab strip — 40% width, 8px tall */}
      <div className="flex">
        <div
          className={`w-[40%] h-2 rounded-t-[6px] ${TAB_COLORS[variant]}`}
        />
      </div>

      {/* Body */}
      <div
        className={`bg-surface p-3 rounded-tr-[10px] rounded-b-[10px] ${
          variant === "active" ? "border-t-[1.5px] border-t-rider" : ""
        }`}
      >
        {/* Emoji */}
        <div className="text-[22px] mb-1">{emoji}</div>

        {/* Name */}
        <div className="font-black text-[13px] text-text truncate">{name}</div>

        {/* Subline */}
        <div className="font-mono text-[10px] text-text-mute mt-0.5">
          {betCount} bets · {totalDisplay}
        </div>
      </div>
    </button>
  );
}
