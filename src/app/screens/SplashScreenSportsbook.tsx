import { SportsbookButton } from "../components/SportsbookButton";

interface SplashScreenSportsbookProps {
  onEnter: () => void;
  onLogin: () => void;
}

export function SplashScreenSportsbook({ onEnter, onLogin }: SplashScreenSportsbookProps) {
  return (
    <div className="h-full bg-bg-primary diagonal-grid grain-texture flex flex-col items-center justify-between px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Wordmark */}
        <h1 className="lynk-wordmark text-[64px] font-black text-text-primary mb-4">
          LYNK
        </h1>

        {/* Pill badges */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-semibold px-3 py-1 bg-bg-elevated rounded-full">
            Ride
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-xs font-semibold px-3 py-1 bg-bg-elevated rounded-full">
            Doubt
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-xs font-semibold px-3 py-1 bg-bg-elevated rounded-full">
            Forfeit
          </span>
        </div>

        {/* Tagline */}
        <p className="text-text-primary text-center text-base font-medium">
          The stakes are real.<br />The punishments are worse.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full space-y-3 mb-8">
        <SportsbookButton onClick={onEnter}>
          Enter
        </SportsbookButton>
        <SportsbookButton onClick={onLogin} variant="ghost">
          Log in
        </SportsbookButton>
      </div>

      {/* Odds ticker */}
      <div className="w-screen -mx-6 overflow-hidden bg-bg-elevated py-2 border-t border-border-subtle">
        <div className="whitespace-nowrap">
          <span className="inline-block animate-marquee text-text-muted text-xs font-medium">
            Mike · Lost · Owes $20 · Sarah · Won streak 4 · The Boys · 3 active bets · 
            Mike · Lost · Owes $20 · Sarah · Won streak 4 · The Boys · 3 active bets
          </span>
        </div>
      </div>
    </div>
  );
}
