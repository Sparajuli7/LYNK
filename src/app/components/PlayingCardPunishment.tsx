interface PlayingCardPunishmentProps {
  punishment: string;
  difficulty: 'mild' | 'medium' | 'savage';
  category?: string;
  completionRate?: number;
  timesAssigned?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function PlayingCardPunishment({
  punishment,
  difficulty,
  category: _category,
  completionRate,
  timesAssigned,
  onSwipeLeft,
  onSwipeRight
}: PlayingCardPunishmentProps) {
  const getRank = () => {
    if (difficulty === 'mild') return Math.floor(Math.random() * 9) + 2; // 2-10
    if (difficulty === 'medium') return ['J', 'Q'][Math.floor(Math.random() * 2)];
    return ['K', 'A'][Math.floor(Math.random() * 2)];
  };

  const suit = ['♠', '♥', '♣', '♦'][Math.floor(Math.random() * 4)];
  const rank = getRank();
  const isRed = suit === '♥' || suit === '♦';

  const difficultyColor = {
    mild: 'text-accent-green',
    medium: 'text-gold',
    savage: 'text-accent-coral'
  }[difficulty];

  return (
    <div className="relative">
      <div className="bg-bg-elevated dark:bg-bg-card rounded-2xl border-2 border-border-subtle p-6 min-h-[320px] flex flex-col relative overflow-hidden card-shadow-light">
        {/* Card rank and suit - top left */}
        <div className="absolute top-4 left-4 flex flex-col items-center">
          <div className={`text-2xl font-black tabular-nums ${isRed ? 'text-accent-coral' : 'text-text-primary'}`}>
            {rank}
          </div>
          <div className={`text-2xl card-suit ${isRed ? 'text-accent-coral' : 'text-text-primary'}`}>
            {suit}
          </div>
        </div>

        {/* Card rank and suit - bottom right (rotated) */}
        <div className="absolute bottom-4 right-4 flex flex-col items-center rotate-180">
          <div className={`text-2xl font-black tabular-nums ${isRed ? 'text-accent-coral' : 'text-text-primary'}`}>
            {rank}
          </div>
          <div className={`text-2xl card-suit ${isRed ? 'text-accent-coral' : 'text-text-primary'}`}>
            {suit}
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
          {/* Large emoji or icon */}
          <div className="text-6xl mb-6">
          </div>

          {/* Punishment text */}
          <p className="text-center font-bold text-base text-text-primary leading-snug mb-4">
            {punishment}
          </p>

          {/* Difficulty badge */}
          <div className="px-4 py-2 bg-bg-primary rounded-full">
            <span className={`text-sm font-bold uppercase tracking-wide ${difficultyColor}`}>
              {difficulty}
            </span>
          </div>
        </div>

        {/* Stats if provided */}
        {(completionRate !== undefined || timesAssigned !== undefined) && (
          <div className="absolute bottom-20 left-0 right-0 px-4">
            <div className="bg-bg-primary/80 backdrop-blur-sm rounded-lg p-2 text-center">
              {timesAssigned && (
                <p className="text-xs text-text-muted mb-1">
                  Assigned {timesAssigned} times
                </p>
              )}
              {completionRate !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-bg-elevated overflow-hidden">
                    <div 
                      className="h-full bg-accent-green"
                      style={{ width: `${completionRate}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-accent-green tabular-nums">
                    {completionRate}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Swipe hint at bottom */}
        <div className="text-center text-xs text-text-muted mt-auto pt-4">
          ← skip    select →
        </div>
      </div>
    </div>
  );
}
