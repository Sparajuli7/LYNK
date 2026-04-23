const STRIP_COLORS = {
  won: "bg-rider",
  lost: "bg-doubter",
  disputed: "bg-warning",
  live: "bg-text-mute",
  pending: "bg-text-mute",
} as const;

const LABEL_COLORS = {
  won: "text-rider",
  lost: "text-doubter",
  disputed: "text-warning",
  live: "text-text-mute",
  pending: "text-text-mute",
} as const;

interface TicketStubProps {
  status: "won" | "lost" | "disputed" | "live" | "pending";
  title: string;
  amountDisplay: string;
  onClick?: () => void;
}

export function TicketStub({
  status,
  title,
  amountDisplay,
  onClick,
}: TicketStubProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full bg-surface rounded-[var(--radius-ticket)] overflow-hidden text-left"
    >
      {/* Colored top strip */}
      <div className={`h-[3px] ${STRIP_COLORS[status]}`} />

      {/* Body */}
      <div className="p-2 space-y-1.5">
        {/* Status label */}
        <span
          className={`font-mono text-[8px] font-bold tracking-[0.1em] uppercase ${LABEL_COLORS[status]}`}
        >
          <span aria-hidden="true">● </span>
          {status}
        </span>

        {/* Title (2-line clamp) */}
        <p className="text-[12px] font-bold text-text leading-tight line-clamp-2">
          {title}
        </p>

        {/* Result amount */}
        <span className="block font-mono font-black text-[15px] text-text">
          {amountDisplay}
        </span>
      </div>
    </button>
  );
}
