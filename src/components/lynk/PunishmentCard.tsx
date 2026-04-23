interface PunishmentCardProps {
  title: string;
  deadlineText: string;
  assignedBy?: string;
}

export function PunishmentCard({
  title,
  deadlineText,
  assignedBy,
}: PunishmentCardProps) {
  return (
    <div className="bg-surface border-[1.5px] border-doubter/35 rounded-xl overflow-hidden">
      {/* Warning tape stripe */}
      <div
        className="h-1"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, var(--color-doubter) 0px 6px, var(--color-surface) 6px 12px)",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="p-4">
        {/* Warning label */}
        <div className="text-doubter text-[11px] font-bold tracking-wider mb-2">
          ⚠ YOUR PUNISHMENT
        </div>

        {/* Title */}
        <div className="font-black text-[17px] text-text leading-tight">
          {title}
        </div>

        {/* Deadline */}
        <div className="text-[12px] text-text-mute mt-2">
          Deadline:{" "}
          <span className="text-doubter font-bold">{deadlineText}</span>
        </div>

        {/* Assigned by */}
        {assignedBy && (
          <div className="text-[11px] text-text-mute mt-1">
            Assigned by {assignedBy}
          </div>
        )}
      </div>
    </div>
  );
}
