interface SectionHeaderProps {
  title: string;
  meta?: string;
  /** Color class for the metadata text, e.g. "text-rider" or "text-warning" */
  metaColor?: string;
  /** Color class for a leading dot indicator, e.g. "bg-rider" */
  dotColor?: string;
  /** Optional right-side action element (e.g. a button) */
  action?: React.ReactNode;
}

export function SectionHeader({
  title,
  meta,
  metaColor = "text-text-mute",
  dotColor,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {dotColor && (
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}
              aria-hidden="true"
            />
          )}
          <h2 className="font-black italic tracking-tighter text-text whitespace-nowrap pr-2">
            {title}
          </h2>
        </div>
        {meta && (
          <div
            className={`text-[11px] font-bold tracking-[0.1em] mt-1 ${metaColor}`}
          >
            {meta}
          </div>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
