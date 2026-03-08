import { OddsBar } from "./OddsBar";

interface BetCardProps {
  groupName: string;
  countdown: string;
  claimText: string;
  claimantName: string;
  claimantAvatar: string;
  ridersPercent: number;
  doubtersPercent: number;
  ridersCount: number;
  doubtersCount: number;
  stake: string;
  status: 'active' | 'proof' | 'completed' | 'disputed';
  urgent?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function BetCard({
  groupName,
  countdown,
  claimText,
  claimantName,
  claimantAvatar,
  ridersPercent,
  doubtersPercent,
  ridersCount,
  doubtersCount,
  stake,
  status,
  urgent = false,
  compact = false,
  onClick
}: BetCardProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`shrink-0 w-[280px] text-left bg-bg-card rounded-xl border border-border-subtle p-3 transition-all hover:shadow-md`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 bg-bg-elevated rounded-full uppercase tracking-wide truncate">
            {groupName}
          </span>
          <span className="text-xs font-bold tabular-nums text-text-primary shrink-0">
            {countdown || '—'}
          </span>
        </div>
        <h3 className="text-sm font-bold text-text-primary line-clamp-2 leading-snug mb-2">
          {claimText}
        </h3>
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 rounded-full bg-bg-elevated overflow-hidden">
            <img src={claimantAvatar} alt={claimantName} className="w-full h-full object-cover" />
          </div>
          <span className="text-[11px] text-text-muted truncate">{claimantName}</span>
        </div>
        <div className="h-1.5 overflow-hidden flex rounded-full">
          <div className="bg-accent-green" style={{ width: `${ridersPercent}%` }} />
          <div className="bg-accent-coral" style={{ width: `${doubtersPercent}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] font-bold bg-bg-elevated px-2 py-0.5 rounded-full">
            {stake}
          </span>
          <span className="text-[10px] font-bold text-accent-green uppercase tracking-wider">
            JOIN →
          </span>
        </div>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`w-full text-left bg-bg-card rounded-xl border border-border-subtle p-4 transition-all hover:shadow-lg card-shadow-light dark:card-inner-glow`}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 bg-bg-elevated rounded-full uppercase tracking-wide">
            {groupName}
          </span>
        </div>
        {status === 'proof' ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-elevated border border-border-subtle rounded-full">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide">
              PROOF DROPPED
            </span>
          </div>
        ) : (
          <span className="text-sm font-black tabular-nums scoreboard-digit text-text-primary">
            {countdown}
          </span>
        )}
      </div>

      {/* Claim */}
      <h3 className="text-lg font-bold text-text-primary mb-3 line-clamp-2 leading-snug">
        {claimText}
      </h3>

      {/* Claimant */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-full bg-bg-elevated overflow-hidden relative">
          <img src={claimantAvatar} alt={claimantName} className="w-full h-full object-cover" />
        </div>
        <span className="text-sm">
          <span className="font-semibold text-text-primary">{claimantName}</span>
          <span className="text-text-muted ml-1">claims</span>
        </span>
      </div>

      {/* Odds Bar - THE signature UI element */}
      <OddsBar 
        ridersPercent={ridersPercent}
        doubtersPercent={doubtersPercent}
        ridersCount={ridersCount}
        doubtersCount={doubtersCount}
      />

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs font-bold bg-bg-elevated px-3 py-1.5 rounded-full">
          {stake}
        </span>
        <span className="text-xs font-bold text-accent-green uppercase tracking-wider">
          JOIN →
        </span>
      </div>
    </button>
  );
}
