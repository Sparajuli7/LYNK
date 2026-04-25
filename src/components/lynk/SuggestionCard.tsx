import { formatMoney } from '@/lib/utils/formatters'
import { SignalLabel } from './SignalLabel'
import type { RankedSuggestion } from '@/lib/suggestions'

interface SuggestionCardProps {
  suggestion: RankedSuggestion
  onUse: (suggestion: RankedSuggestion) => void
  onLongPress?: (suggestion: RankedSuggestion) => void
}

export function SuggestionCard({ suggestion, onUse, onLongPress }: SuggestionCardProps) {
  const { template, signal, signalLabel, contextLine } = suggestion
  const isRematch = signal === 'rematch'
  const borderColor = isRematch ? 'border-doubter/25' : 'border-rider/25'

  let pressTimer: ReturnType<typeof setTimeout> | null = null

  const handlePointerDown = () => {
    if (!onLongPress) return
    pressTimer = setTimeout(() => onLongPress(suggestion), 500)
  }

  const handlePointerUp = () => {
    if (pressTimer) clearTimeout(pressTimer)
  }

  return (
    <div
      className={`shrink-0 w-[65%] bg-surface border-[1.5px] ${borderColor} rounded-xl p-2.5 select-none`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="flex justify-between items-center mb-1.5">
        <SignalLabel signal={signal} label={signalLabel} />
      </div>

      <div className="font-black text-[14px] text-text leading-[1.2] tracking-[-0.01em] mb-2">
        {template.title}
      </div>

      {contextLine && (
        <div className={`text-[9px] font-bold mb-2 ${isRematch ? 'text-doubter' : 'text-text-dim'}`}>
          {contextLine}
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-[9px] text-text-mute font-mono">
          Suggested {formatMoney(template.suggestedStakeCents)} {'\u00B7'} {template.suggestedDurationDays}d
        </span>
        <button
          onClick={() => onUse(suggestion)}
          className={`font-black text-[10px] px-2.5 py-1 rounded-lg tracking-[0.08em] transition-all ${
            isRematch
              ? 'bg-doubter-dim border-[1.5px] border-doubter text-doubter'
              : 'bg-rider text-bg'
          }`}
        >
          USE {'\u2192'}
        </button>
      </div>
    </div>
  )
}
