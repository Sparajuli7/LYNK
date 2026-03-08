import { iosSpacing } from '@/lib/utils/iosSpacing'

interface OnboardingProps {
  onNext: () => void;
  onSkip: () => void;
}

export function Onboarding({ onNext, onSkip }: OnboardingProps) {
  return (
    <div
      className="h-full bg-bg-primary grain-texture flex flex-col px-6 overflow-y-auto"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2.5 mb-12">
        <div className="w-2 h-2 rounded-full bg-text-muted"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-accent-green"></div>
        <div className="w-2 h-2 rounded-full bg-text-muted"></div>
      </div>

      {/* Illustration */}
      <div className="flex-1 flex items-center justify-center mb-8">
        <div className="w-72 h-72 rounded-3xl bg-bg-card border border-border-subtle flex items-center justify-center relative overflow-hidden">
          {/* Abstract illustration - two opposing forces */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-8">
              {/* Left side - green */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-2xl bg-accent-green/20 border-2 border-accent-green flex items-center justify-center">
                  <span className="text-5xl"></span>
                </div>
                <div className="text-xs font-bold text-accent-green uppercase tracking-wide">
                  RIDERS
                </div>
              </div>

              {/* Center divider */}
              <div className="text-3xl font-black text-text-muted">VS</div>

              {/* Right side - coral */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-2xl bg-accent-coral/20 border-2 border-accent-coral flex items-center justify-center">
                  <span className="text-5xl"></span>
                </div>
                <div className="text-xs font-bold text-accent-coral uppercase tracking-wide">
                  DOUBTERS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-8">
        <h2 className="text-[32px] font-black text-text-primary mb-4" style={{ letterSpacing: '-0.02em' }}>
          Ride or Doubt.
        </h2>
        <p className="text-text-muted text-lg leading-relaxed">
          Pick your side on every claim. Back your friend or bet against them.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <button
          onClick={onNext}
          className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold text-base glow-green btn-pressed"
        >
          Next
        </button>
        <button
          onClick={onSkip}
          className="w-full text-accent-green font-bold text-base btn-pressed"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
