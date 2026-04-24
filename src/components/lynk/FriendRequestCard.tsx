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
      {/* Avatar with amber ring */}
      <div className="w-10 h-10 rounded-full ring-2 ring-warning flex-shrink-0 p-[2px]">
        <div className="w-full h-full rounded-full overflow-hidden bg-surface-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-surface-3" />
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
