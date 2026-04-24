import { AvatarStack } from "./AvatarStack";

interface MutualFriendsRowProps {
  count: number;
  names: string[];
  avatars: { avatarUrl?: string }[];
  onClick?: () => void;
}

export function MutualFriendsRow({
  count,
  names,
  avatars,
  onClick,
}: MutualFriendsRowProps) {
  const namesList = names.slice(0, 3).join(", ");

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full bg-surface rounded-xl p-3 flex items-center gap-3 cursor-pointer text-left"
    >
      {/* Avatar stack */}
      <AvatarStack members={avatars} total={count} size={28} max={3} />

      {/* Text */}
      <div className="flex-1 min-w-0 text-[14px]">
        <span className="text-rider font-bold">{count} mutual</span>
        {namesList && (
          <span className="text-text-dim"> · {namesList}</span>
        )}
      </div>

      {/* Chevron */}
      <span className="text-text-mute flex-shrink-0" aria-hidden="true">
        &#x203A;
      </span>
    </button>
  );
}
