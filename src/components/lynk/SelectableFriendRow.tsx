interface SelectableFriendRowProps {
  displayName: string;
  username: string;
  avatarUrl?: string;
  isRival?: boolean;
  h2hDisplay?: string;
  hasLiveBet?: boolean;
  selected: boolean;
  onToggle: () => void;
}

export function SelectableFriendRow({
  displayName,
  username,
  avatarUrl,
  isRival,
  h2hDisplay,
  hasLiveBet,
  selected,
  onToggle,
}: SelectableFriendRowProps) {
  const borderColor = hasLiveBet
    ? "border-l-rider"
    : isRival
    ? "border-l-doubter"
    : "border-l-transparent";

  const ringColor = hasLiveBet
    ? "ring-rider"
    : isRival
    ? "ring-doubter"
    : "ring-[#333]";

  return (
    <button
      onClick={onToggle}
      className={`w-full rounded-[10px] p-[10px_12px] flex items-center gap-2.5 border-l-[3px] text-left ${borderColor} ${
        selected
          ? "bg-rider/[0.06] border border-rider/30"
          : "bg-surface border border-transparent"
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-[22px] h-[22px] rounded-[4px] flex items-center justify-center flex-shrink-0 ${
          selected
            ? "bg-rider"
            : "bg-transparent border-2 border-text-mute"
        }`}
      >
        {selected && (
          <svg
            width="12"
            height="10"
            viewBox="0 0 12 10"
            fill="none"
            className="text-bg"
          >
            <path
              d="M1 5L4.5 8.5L11 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full ring-2 ${ringColor} flex-shrink-0 overflow-hidden bg-surface-3`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-3" />
        )}
      </div>

      {/* Name + subline */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-black text-[13px] text-text truncate">
            {displayName}
          </span>
          {hasLiveBet && <span className="flex-shrink-0">🔥</span>}
          {isRival && (
            <span className="flex-shrink-0 bg-doubter-dim text-doubter text-[8px] font-black px-[5px] py-[2px] rounded-[3px] tracking-[0.1em]">
              RIVAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-text-dim mt-0.5">
          <span>@{username}</span>
          {h2hDisplay && (
            <>
              <span>·</span>
              <span className={isRival ? "text-doubter font-bold" : "text-rider font-bold"}>
                {h2hDisplay}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
