interface OutcomeWinProps {
  onShare: () => void;
  onBack: () => void;
}

export function OutcomeWin({ onShare, onBack }: OutcomeWinProps) {
  return (
    <div 
      className="h-full flex flex-col items-center justify-between px-6 py-12 relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #1A1400 0%, #0A0A0F 100%)'
      }}
    >
      {/* Confetti dots - static decorative */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#FFB800', '#00E676', '#FFFFFF'][Math.floor(Math.random() * 3)],
              opacity: Math.random() * 0.6 + 0.4
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        {/* WINNER text */}
        <h1 className="text-[64px] font-black text-gold mb-8 text-center" style={{ letterSpacing: '-0.02em' }}>
          WINNER
        </h1>

        {/* Winner avatar with crown */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold to-accent-green overflow-hidden border-4 border-gold">
            <img 
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"
              alt="Winner"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-4xl">
          </div>
        </div>

        <p className="text-text-primary font-bold text-xl mb-2">Jordan</p>

        {/* Collecting section */}
        <div className="w-full max-w-sm mt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted text-center mb-4">
            COLLECTING:
          </p>
          
          <div className="bg-bg-card/50 backdrop-blur-sm border border-gold/30 rounded-2xl p-6 text-center">
            <div className="text-5xl font-black text-accent-green tabular-nums mb-3">
              $25
            </div>
            <p className="text-sm text-text-muted">or punishment incoming</p>
          </div>

          {/* Losers */}
          <div className="mt-6 text-center">
            <p className="text-xs text-accent-coral">
              Mike owes you · Sarah owes you · Alex owes you
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full space-y-3 relative z-10">
        <button
          onClick={onShare}
          className="w-full h-14 rounded-2xl bg-gold text-bg-primary font-bold text-base btn-pressed shadow-xl"
        >
          Share Result
        </button>
        <button
          onClick={onBack}
          className="w-full h-14 rounded-2xl bg-transparent border border-gold text-gold font-bold text-base btn-pressed"
        >
          Back to Group
        </button>
      </div>
    </div>
  );
}
