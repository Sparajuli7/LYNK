interface SplashProps {
  onEnter: () => void;
  onLogin: () => void;
}

export function Splash({ onEnter, onLogin }: SplashProps) {
  return (
    <div className="h-full bg-bg-primary diagonal-grid grain-texture flex flex-col items-center justify-between px-6 py-12 relative">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* LYNK wordmark with glitch */}
        <h1
          className="glitch-text text-[72px] font-black text-text-primary italic mb-6"
          data-text="LYNK"
          style={{ letterSpacing: '-0.02em' }}
        >
          LYNK
        </h1>

        {/* Pills */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-semibold px-3 py-1.5 bg-bg-elevated rounded-full">
            Ride
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-xs font-semibold px-3 py-1.5 bg-bg-elevated rounded-full">
            Doubt
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-xs font-semibold px-3 py-1.5 bg-bg-elevated rounded-full">
            Forfeit
          </span>
        </div>

        {/* Tagline */}
        <p className="text-text-muted text-center text-base font-medium">
          The stakes are real.<br />The punishments are worse.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full space-y-3 mb-8 relative z-10">
        <button
          onClick={onEnter}
          className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold text-base glow-green btn-pressed"
        >
          Enter
        </button>
        <button
          onClick={onLogin}
          className="w-full h-14 rounded-2xl bg-transparent border border-accent-green text-accent-green font-bold text-base btn-pressed"
        >
          Log in
        </button>
      </div>

      {/* Odds ticker */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden bg-bg-elevated py-2.5 border-t border-border-subtle">
        <div className="whitespace-nowrap">
          <span className="inline-block animate-marquee text-text-muted text-xs font-medium">
            Mike · Lost · Owes $20  ·  Sarah · Won streak 4  ·  The Boys · 3 active bets  ·  
            Mike · Lost · Owes $20  ·  Sarah · Won streak 4  ·  The Boys · 3 active bets
          </span>
        </div>
      </div>
    </div>
  );
}
