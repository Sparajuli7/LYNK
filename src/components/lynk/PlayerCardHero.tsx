interface PlayerCardHeroProps {
  displayName: string;
  username: string;
  avatarUrl?: string;
  serialNumber: string;
  streak?: number;
  bets: number;
  winPct: number;
  punishments: number;
  earned: number;
  /** Override the card border color (CSS value). Defaults to rider/30. */
  borderColor?: string;
  /** Override the serial chip background class. Defaults to "bg-rider". */
  chipBg?: string;
  /** Override the serial chip text class. Defaults to "text-bg". */
  chipText?: string;
  /** Optional node rendered after the username (e.g. RelationshipStatusChips). */
  afterName?: React.ReactNode;
}

export function PlayerCardHero({
  displayName,
  username,
  avatarUrl,
  serialNumber,
  streak,
  bets,
  winPct,
  punishments,
  earned,
  borderColor,
  chipBg,
  chipText,
  afterName,
}: PlayerCardHeroProps) {
  const chipBgClass = chipBg ?? "bg-rider";
  const chipTextClass = chipText ?? "text-bg";

  return (
    <div
      className="bg-surface-2 rounded-[18px] p-[18px] relative"
      style={{ border: `1.5px solid ${borderColor ?? "rgba(0,230,118,0.3)"}` }}
    >
      {/* Serial number chip — top right */}
      <div className={`absolute top-[18px] right-[18px] ${chipBgClass} ${chipTextClass} font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm`}>
        #{serialNumber}
      </div>

      {/* Top section: avatar + identity */}
      <div className="flex items-center gap-4 mb-4">
        {/* Avatar ring */}
        <div className="w-[80px] h-[80px] rounded-full p-[3.5px] bg-rider flex-shrink-0">
          <div className="w-full h-full rounded-full bg-bg overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-2" />
            )}
          </div>
        </div>

        {/* Name + handle + streak */}
        <div className="min-w-0 flex-1">
          <div className="font-black italic text-[32px] tracking-[-0.04em] text-text leading-none truncate pr-2">
            {displayName}
          </div>
          <div className="text-[13px] text-text-dim mt-0.5">@{username}</div>
          {afterName}
          {streak != null && streak > 0 && (
            <div className="inline-flex items-center gap-1 mt-1.5 bg-rider-dim text-rider text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span>🔥</span>
              <span>{streak} streak</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid — dashed top border */}
      <div className="border-t-[1.5px] border-dashed border-border-hi pt-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          {/* BETS */}
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-text">
              {bets}
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              BETS
            </div>
          </div>

          {/* WIN% */}
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-rider">
              {winPct}%
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              WIN%
            </div>
          </div>

          {/* PUNISH */}
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-doubter">
              {punishments}
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              PUNISH
            </div>
          </div>

          {/* EARNED */}
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-text">
              ${earned}
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              EARNED
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
