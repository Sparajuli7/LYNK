import { AvatarStack } from "./AvatarStack";

interface GroupRowProps {
  name: string;
  emoji: string;
  liveBetCount: number;
  atStakeCents: number;
  members: { avatarUrl?: string }[];
  totalMembers: number;
  lastActivity?: string;
  onClick: () => void;
}

export function GroupRow({
  name,
  emoji,
  liveBetCount,
  atStakeCents,
  members,
  totalMembers,
  lastActivity,
  onClick,
}: GroupRowProps) {
  const isLive = liveBetCount > 0;
  return (
    <button
      onClick={onClick}
      className={`w-full bg-surface rounded-[10px] p-3 flex items-center gap-2.5 text-left border-l-[3px] ${
        isLive ? "border-l-rider" : "border-l-transparent"
      }`}
    >
      {/* Emoji square */}
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: isLive ? "#2a1810" : "#1e2014" }}
      >
        {emoji}
      </div>

      {/* Middle: name + live count */}
      <div className="flex-1 min-w-0">
        <div className="font-black text-xs text-text truncate">{name}</div>
        <div className="flex gap-2 text-[9px] mt-0.5">
          {isLive ? (
            <>
              <span className="text-rider font-bold">
                {liveBetCount} LIVE BET{liveBetCount > 1 ? "S" : ""}
              </span>
              <span className="text-text-mute">&middot;</span>
              <span className="text-text-dim">
                ${(atStakeCents / 100).toFixed(0)} at stake
              </span>
            </>
          ) : (
            <span className="text-text-dim">
              {lastActivity ?? "No live bets"}
            </span>
          )}
        </div>
      </div>

      {/* Right: AvatarStack */}
      <AvatarStack members={members} total={totalMembers} />
    </button>
  );
}
