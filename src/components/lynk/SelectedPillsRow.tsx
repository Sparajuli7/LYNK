interface SelectedPillsRowProps {
  members: { id: string; displayName: string; avatarUrl?: string }[];
  onRemove: (id: string) => void;
}

export function SelectedPillsRow({ members, onRemove }: SelectedPillsRowProps) {
  if (members.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="bg-rider-dim border-[1.5px] border-rider rounded-full px-2 py-1 flex items-center gap-1.5"
        >
          {/* Mini avatar */}
          <div className="w-[22px] h-[22px] rounded-full overflow-hidden bg-surface-3 flex-shrink-0">
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

          <span className="text-[12px] font-bold text-text">
            {member.displayName}
          </span>

          <button
            onClick={() => onRemove(member.id)}
            className="text-rider text-[10px] cursor-pointer leading-none"
            aria-label={`Remove ${member.displayName}`}
          >
            &#x00D7;
          </button>
        </div>
      ))}
    </div>
  );
}
