import { Perforation } from "./Perforation";
import { OddsBar } from "./OddsBar";
import { StatusPill } from "./StatusPill";

interface ReceiptCardProps {
  betId: string;
  groupName: string;
  groupEmoji: string;
  status: "live" | "voting" | "settled" | "expired";
  title: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  timeLeft: string;
  ridersPct: number;
  riderCount: number;
  doubterCount: number;
  stakeCents?: number;
  /** Pre-formatted stake label (e.g. punishment text). Takes priority over stakeCents. */
  stakeLabel?: string;
  onView?: () => void;
}

export function ReceiptCard({
  betId,
  groupName,
  groupEmoji,
  status,
  title,
  creatorName,
  creatorAvatarUrl,
  timeLeft,
  ridersPct,
  riderCount,
  doubterCount,
  stakeCents,
  stakeLabel,
  onView,
}: ReceiptCardProps) {
  const shortId = betId.slice(0, 4).toUpperCase();
  const stakeDisplay =
    stakeLabel ?? (stakeCents != null ? `$${(stakeCents / 100).toFixed(2)}` : "—");

  return (
    <div
      onClick={onView}
      className="bg-surface rounded-[--radius-card] cursor-pointer overflow-hidden transition-transform active:scale-[0.98]"
    >
      {/* 1. Top perforation */}
      <Perforation />

      {/* 2–5. Main body */}
      <div className="px-4 pt-3 pb-3">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[10px] font-bold text-text-mute tracking-[0.15em] truncate">
            BET #{shortId} · {groupName} {groupEmoji}
          </span>
          <StatusPill status={status} />
        </div>

        {/* Title */}
        <h3 className="font-black text-[19px] leading-tight text-text line-clamp-2 mb-1.5 tracking-[-0.01em]">
          {title}
        </h3>

        {/* Subline: creator + time */}
        <div className="flex items-center gap-1.5 text-[12px] text-text-dim mb-3.5">
          <div className="w-4 h-4 rounded-full bg-surface-3 flex-shrink-0 overflow-hidden">
            {creatorAvatarUrl ? (
              <img
                src={creatorAvatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-3" />
            )}
          </div>
          <span>{creatorName} &middot; {timeLeft}</span>
        </div>

        {/* OddsBar */}
        <OddsBar
          ridersPct={ridersPct}
          riderCount={riderCount}
          doubterCount={doubterCount}
        />
      </div>

      {/* 6. Bottom perforation */}
      <Perforation />

      {/* 7. Footer strip */}
      <div className="bg-surface-2 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold text-text-mute tracking-[0.1em]">
            STAKE
          </div>
          <div className="text-lg font-black font-mono tracking-tight text-text">
            {stakeDisplay}
          </div>
        </div>
        {onView && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="text-[12px] font-black tracking-[0.1em] px-[18px] py-2 rounded-full border-[1.5px] border-rider text-rider transition-colors hover:bg-rider/10"
          >
            VIEW &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
