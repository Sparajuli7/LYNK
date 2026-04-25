import { SuggestionCard } from './SuggestionCard'
import type { RankedSuggestion } from '@/lib/suggestions'

interface SuggestionEmptyStateProps {
  suggestions: RankedSuggestion[]
  onUse: (suggestion: RankedSuggestion) => void
  onPlaceBet: () => void
}

export function SuggestionEmptyState({ suggestions, onUse, onPlaceBet }: SuggestionEmptyStateProps) {
  return (
    <div className="px-5 py-6">
      <h3 className="font-black italic text-lg text-text mb-1">
        Ready to make your first bet?
      </h3>
      <p className="text-[12px] text-text-dim mb-4">
        Pick one of these or write your own.
      </p>
      <div className="flex flex-col gap-2.5 mb-4">
        {suggestions.slice(0, 3).map((s) => (
          <div key={s.template.id} className="w-full">
            <SuggestionCard suggestion={s} onUse={onUse} />
          </div>
        ))}
      </div>
      <button
        onClick={onPlaceBet}
        className="w-full py-3.5 rounded-[14px] bg-rider text-bg font-black tracking-[0.12em] text-[14px] shadow-[0_0_0_5px] shadow-rider-ring"
      >
        + PLACE BET
      </button>
    </div>
  )
}
