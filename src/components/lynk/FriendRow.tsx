interface FriendRowProps {
  displayName: string;
  username: string;
  avatarUrl?: string;
  hasLiveBet?: boolean;
  isRival?: boolean;
  h2hWins?: number;
  h2hLosses?: number;
  owesDisplay?: string;
  lastBetDisplay?: string;
  onChallenge?: () => void;
  onRematch?: () => void;
  onView?: () => void;
}

export function FriendRow({
  displayName,
  username,
  avatarUrl,
  hasLiveBet,
  isRival,
  h2hWins = 0,
  h2hLosses = 0,
  owesDisplay,
  lastBetDisplay,
  onChallenge,
  onRematch,
  onView,
}: FriendRowProps) {
  const borderColor = hasLiveBet
    ? "border-l-rider"
    : isRival
    ? "border-l-doubter"
    : "border-l-transparent";

  const ringBg = hasLiveBet
    ? "bg-rider"
    : isRival
    ? "bg-doubter"
    : "bg-[#333]";

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={`bg-surface rounded-[10px] p-[10px_12px] flex items-center gap-2.5 border-l-[3px] ${borderColor}`}
    >
      {/* Avatar with padding-based ring */}
      <div className={`w-10 h-10 rounded-full ${ringBg} p-[2px] flex-shrink-0`}>
        <div className="w-full h-full rounded-full bg-[#2a2a35] overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-black text-[14px]">{initial}</span>
          )}
        </div>
      </div>

      {/* Middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-black text-[13px] text-text truncate">
            {displayName}
          </span>
          {hasLiveBet && <span className="flex-shrink-0 text-[10px]">🔥</span>}
          {isRival && (
            <span className="flex-shrink-0 bg-[rgba(255,61,87,0.15)] text-doubter text-[8px] font-black px-[5px] py-[2px] rounded-[3px] tracking-[0.1em]">
              RIVAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
          {hasLiveBet ? (
            <>
              <span className="text-rider font-bold">LIVE BET</span>
              <span className="text-text-mute">·</span>
              <span className="text-text-dim">{h2hWins}W · {h2hLosses}L</span>
            </>
          ) : isRival ? (
            <>
              <span className="text-doubter font-bold">
                H2H: {h2hWins}W · {h2hLosses}L
              </span>
              {owesDisplay && (
                <>
                  <span className="text-text-mute">·</span>
                  <span className="text-text-dim">{owesDisplay}</span>
                </>
              )}
            </>
          ) : (
            <>
              {lastBetDisplay && (
                <span className="text-text-dim">{lastBetDisplay}</span>
              )}
              {lastBetDisplay && (h2hWins > 0 || h2hLosses > 0) && (
                <span className="text-text-mute">·</span>
              )}
              {(h2hWins > 0 || h2hLosses > 0) && (
                <span className="text-rider font-bold">
                  {h2hWins}W · {h2hLosses}L
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action button */}
      {hasLiveBet && onChallenge ? (
        <button
          onClick={onChallenge}
          className="flex-shrink-0 bg-rider-dim border-[1.5px] border-rider text-rider font-black text-[10px] px-[10px] py-[6px] rounded-lg tracking-[0.1em]"
        >
          CHALLENGE
        </button>
      ) : isRival && onRematch ? (
        <button
          onClick={onRematch}
          className="flex-shrink-0 bg-doubter-dim border-[1.5px] border-doubter text-doubter font-black text-[10px] px-[10px] py-[6px] rounded-lg tracking-[0.1em]"
        >
          REMATCH
        </button>
      ) : onView ? (
        <button
          onClick={onView}
          className="flex-shrink-0 bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[10px] px-[10px] py-[6px] rounded-lg tracking-[0.1em]"
        >
          VIEW
        </button>
      ) : null}
    </div>
  );
}
