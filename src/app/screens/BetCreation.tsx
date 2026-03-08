import { Shuffle } from "lucide-react";
import { PrimaryButton } from "../components/PrimaryButton";

interface BetCreationProps {
  onNext: () => void;
}

export function BetCreation({ onNext }: BetCreationProps) {
  return (
    <div className="h-full bg-bg-primary flex flex-col px-6 py-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-1 bg-border-subtle rounded-full overflow-hidden">
          <div className="h-full bg-accent-green w-[80%]"></div>
        </div>
        <p className="text-xs text-text-muted text-right mt-2">Step 4 of 5</p>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-[32px] font-extrabold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
          What happens if they lose?
        </h2>
      </div>

      {/* Toggle */}
      <div className="flex gap-2 mb-8">
        <button className="flex-1 py-3 rounded-full bg-bg-elevated text-text-muted font-semibold">
          Money
        </button>
        <button className="flex-1 py-3 rounded-full bg-accent-coral text-white font-semibold">
          Punishment
        </button>
      </div>

      {/* Card Stack */}
      <div className="flex-1 flex items-center justify-center mb-8 relative">
        <div className="relative w-full max-w-xs" style={{ perspective: '1000px' }}>
          {/* Background Cards */}
          <div 
            className="absolute inset-0 bg-bg-elevated rounded-3xl border border-border-subtle"
            style={{ 
              transform: 'translateY(16px) scale(0.95)',
              zIndex: 1,
              opacity: 0.5
            }}
          ></div>
          <div 
            className="absolute inset-0 bg-bg-elevated rounded-3xl border border-border-subtle"
            style={{ 
              transform: 'translateY(8px) scale(0.97)',
              zIndex: 2,
              opacity: 0.7
            }}
          ></div>

          {/* Top Card */}
          <div 
            className="relative bg-bg-elevated rounded-3xl border border-border-subtle p-8 flex flex-col items-center justify-center"
            style={{ 
              minHeight: '320px',
              zIndex: 3
            }}
          >
            {/* Emoji */}
            <div className="text-7xl mb-6"></div>

            {/* Punishment Text */}
            <p className="text-white font-bold text-center text-xl mb-6 leading-tight">
              Post an embarrassing throwback to your main story
            </p>

            {/* Difficulty Badge */}
            <div className="bg-accent-coral/20 border border-accent-coral px-4 py-2 rounded-full">
              <span className="text-accent-coral font-semibold text-sm">Medium</span>
            </div>

            {/* Swipe Hint */}
            <p className="text-text-muted text-xs mt-8">← skip  select →</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 pb-8">
        <button className="w-full py-3 rounded-2xl border border-border-subtle text-white font-medium flex items-center justify-center gap-2 btn-pressed">
          <Shuffle className="w-4 h-4" />
          Randomize
        </button>
        <button className="w-full text-text-muted font-medium">
          Suggest your own +
        </button>
        <PrimaryButton onClick={onNext}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}
