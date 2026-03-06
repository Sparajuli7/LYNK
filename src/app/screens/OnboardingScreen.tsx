import { PrimaryButton } from "../components/PrimaryButton";

interface OnboardingScreenProps {
  onNext: () => void;
  onSkip: () => void;
}

export function OnboardingScreen({ onNext, onSkip }: OnboardingScreenProps) {
  return (
    <div className="h-full bg-bg-primary flex flex-col px-6 py-8">
      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2 mb-12">
        <div className="w-2 h-2 rounded-full bg-text-muted"></div>
        <div className="w-2 h-2 rounded-full bg-accent-green"></div>
        <div className="w-2 h-2 rounded-full bg-text-muted"></div>
      </div>

      {/* Illustration Placeholder */}
      <div className="flex-1 flex items-center justify-center mb-8">
        <div className="w-64 h-64 rounded-3xl bg-bg-elevated border border-border-subtle flex items-center justify-center">
          <div className="text-center">
            <div className="flex justify-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-2xl bg-accent-green/20 border-2 border-accent-green flex items-center justify-center">
                <span className="text-4xl"></span>
              </div>
              <div className="w-20 h-20 rounded-2xl bg-accent-coral/20 border-2 border-accent-coral flex items-center justify-center">
                <span className="text-4xl"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-8">
        <h2 className="text-[40px] font-extrabold text-white mb-4 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Ride or Doubt.
        </h2>
        <p className="text-text-muted text-lg">
          Pick your side on every claim. Back your friend or bet against them.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-4 pb-8">
        <PrimaryButton onClick={onNext}>
          Next
        </PrimaryButton>
        <button 
          onClick={onSkip}
          className="w-full text-accent-green font-medium"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
