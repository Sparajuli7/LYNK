const VARIANTS = {
  live:     "bg-rider-dim text-rider",
  voting:   "bg-warning-dim text-warning",
  settled:  "bg-surface-3 text-text-dim",
  expired:  "bg-surface-3 text-text-mute",
  won:      "bg-rider-dim text-rider",
  lost:     "bg-doubter-dim text-doubter",
  disputed: "bg-warning-dim text-warning",
} as const;

type StatusVariant = keyof typeof VARIANTS;

interface StatusPillProps {
  status: StatusVariant;
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const display = label ?? status.toUpperCase();

  return (
    <span
      className={`inline-block text-[8px] font-black tracking-[0.1em] px-1.5 py-0.5 rounded-sm ${VARIANTS[status]}`}
    >
      {display}
    </span>
  );
}
