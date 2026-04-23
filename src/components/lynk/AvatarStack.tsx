interface AvatarStackProps {
  members: { avatarUrl?: string }[];
  total: number;
  /** Diameter in pixels. Defaults to 22. */
  size?: number;
  /** Max visible avatars before showing +N. Defaults to 3. */
  max?: number;
}

export function AvatarStack({
  members,
  total,
  size = 22,
  max = 3,
}: AvatarStackProps) {
  const visible = members.slice(0, max);
  const overflow = total - visible.length;

  return (
    <div className="flex items-center" aria-label={`${total} members`}>
      <div className="flex">
        {visible.map((member, i) => (
          <div
            key={i}
            className="rounded-full bg-surface-3 border-2 border-surface flex-shrink-0 overflow-hidden"
            style={{
              width: size,
              height: size,
              marginLeft: i > 0 ? -(size * 0.36) : 0,
            }}
          >
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-3" />
            )}
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <span className="text-[11px] font-bold text-text-dim ml-1.5">
          +{overflow}
        </span>
      )}
    </div>
  );
}
