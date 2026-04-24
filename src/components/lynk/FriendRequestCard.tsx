interface FriendRequestCardProps {
  displayName: string;
  username: string;
  avatarUrl?: string;
  mutualCount?: number;
  source?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function FriendRequestCard({
  displayName,
  username,
  avatarUrl,
  mutualCount,
  source,
  onAccept,
  onDecline,
}: FriendRequestCardProps) {
  const subline = mutualCount != null && mutualCount > 0
    ? `@${username} · ${mutualCount} mutual friends`
    : source
    ? `@${username} · ${source}`
    : `@${username}`;

  return (
    <div className="bg-surface border-l-[3px] border-l-warning rounded-[10px] p-[10px_12px] flex items-center gap-2.5">
      {/* Avatar with warm amber ring */}
      <div className="w-10 h-10 rounded-full bg-[#3d2f1a] p-[2px] flex-shrink-0">
        <div className="w-full h-full rounded-full bg-[#2a2a35] overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-black text-[14px]">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="font-black text-[13px] text-text truncate">
          {displayName}
        </div>
        <div className="text-[10px] text-text-dim mt-0.5 truncate">
          {subline}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onAccept}
          className="bg-rider-dim border-[1.5px] border-rider text-rider font-black text-[10px] px-[10px] py-[6px] rounded-lg tracking-[0.1em]"
        >
          ACCEPT
        </button>
        <button
          onClick={onDecline}
          className="bg-transparent border-[1.5px] border-[#333] text-[#888] font-black text-[12px] px-2 py-[6px] rounded-lg"
          aria-label="Decline"
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}
