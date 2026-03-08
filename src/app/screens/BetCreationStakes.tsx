import { PlayingCardPunishment } from "../components/PlayingCardPunishment";
import { Shuffle } from "lucide-react";

interface BetCreationStakesProps {
  onNext: () => void;
  onBack: () => void;
}

export function BetCreationStakes({ onNext, onBack }: BetCreationStakesProps) {
  const [selectedType, setSelectedType] = React.useState<'money' | 'punishment' | 'both'>('punishment');

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col">
      {/* Progress bar */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="text-text-primary">
            ← Back
          </button>
          <span className="text-xs font-bold text-text-muted tabular-nums">4 of 5</span>
        </div>
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
          <div className="h-full bg-accent-green w-[80%] transition-all"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {/* Header */}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-2">
          SET THE STAKES
        </h2>

        {/* Three-way toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedType('money')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              selectedType === 'money'
                ? 'bg-accent-green text-white'
                : 'bg-bg-elevated text-text-muted'
            }`}
          >
            Money
          </button>
          <button
            onClick={() => setSelectedType('punishment')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              selectedType === 'punishment'
                ? 'bg-accent-green text-white'
                : 'bg-bg-elevated text-text-muted'
            }`}
          >
            Punishment
          </button>
          <button
            onClick={() => setSelectedType('both')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              selectedType === 'both'
                ? 'bg-accent-green text-white'
                : 'bg-bg-elevated text-text-muted'
            }`}
          >
            Both
          </button>
        </div>

        {/* Money input (if money or both) */}
        {(selectedType === 'money' || selectedType === 'both') && (
          <div className="mb-6">
            <div className="bg-bg-card border border-border-subtle rounded-2xl p-8 text-center">
              {/* Casino chip style */}
              <div className="relative w-40 h-40 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-accent-green flex items-center justify-center border-8 border-bg-primary shadow-2xl">
                  <span className="text-5xl font-black text-white tabular-nums">$20</span>
                </div>
                <button className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bg-elevated border-2 border-border-subtle text-text-primary font-bold">
                  +
                </button>
                <button className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-10 rounded-full bg-bg-elevated border-2 border-border-subtle text-text-primary font-bold">
                  −
                </button>
              </div>

              {/* Preset amounts */}
              <div className="flex gap-2 justify-center mb-4">
                {[5, 10, 20, 50].map(amount => (
                  <button
                    key={amount}
                    className="px-4 py-2 rounded-full bg-bg-elevated text-text-primary font-bold text-sm hover:bg-accent-green hover:text-white transition-all"
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              <p className="text-xs text-text-muted">
                Honor system — you settle in real life
              </p>
            </div>
          </div>
        )}

        {/* Punishment card (if punishment or both) */}
        {(selectedType === 'punishment' || selectedType === 'both') && (
          <div className="mb-6">
            {/* Card stack with perspective */}
            <div className="relative" style={{ perspective: '1000px' }}>
              {/* Background cards */}
              <div 
                className="absolute inset-0 opacity-30"
                style={{ transform: 'translateY(16px) scale(0.94) rotateX(2deg)' }}
              >
                <PlayingCardPunishment
                  punishment="Post a cringe TikTok dance"
                  difficulty="medium"
                  category="Social"
                />
              </div>
              <div 
                className="absolute inset-0 opacity-50"
                style={{ transform: 'translateY(8px) scale(0.97) rotateX(1deg)' }}
              >
                <PlayingCardPunishment
                  punishment="Wear your shirt backwards all day"
                  difficulty="mild"
                  category="Social"
                />
              </div>

              {/* Top card */}
              <div className="relative z-10">
                <PlayingCardPunishment
                  punishment="Post an embarrassing throwback to your main story"
                  difficulty="medium"
                  category="Social"
                  completionRate={71}
                  timesAssigned={43}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              <button className="w-full py-3 rounded-xl border-2 border-border-subtle text-text-primary font-bold flex items-center justify-center gap-2 btn-pressed">
                <Shuffle className="w-4 h-4" />
                Randomize
              </button>
              <button className="w-full text-accent-green font-bold text-sm">
                Create Your Own +
              </button>
            </div>

            {/* Punishment stats */}
            <div className="mt-4 bg-bg-elevated rounded-xl p-4 border border-border-subtle">
              <p className="text-xs text-text-muted mb-2">
                This punishment has been assigned <span className="font-bold text-text-primary">43 times</span>
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-bg-card overflow-hidden">
                  <div className="h-full bg-accent-green w-[71%]"></div>
                </div>
                <div className="flex gap-2 text-xs font-bold tabular-nums">
                  <span className="text-accent-green">71%</span>
                  <span className="text-text-muted">/</span>
                  <span className="text-accent-coral">29%</span>
                </div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-accent-green">completed</span>
                <span className="text-accent-coral">disputed</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-8 pt-4 border-t border-border-subtle bg-bg-primary">
        <button
          onClick={onNext}
          className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold text-base glow-green btn-pressed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Add React import at the top
import React from 'react';
