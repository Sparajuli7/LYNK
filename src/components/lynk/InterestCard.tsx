import type { BetCategory } from '@/lib/suggestions'
import { CATEGORY_META } from '@/lib/suggestions'

interface InterestCardProps {
  category: BetCategory
  selected: boolean
  onToggle: () => void
}

export function InterestCard({ category, selected, onToggle }: InterestCardProps) {
  const meta = CATEGORY_META[category]
  return (
    <button
      onClick={onToggle}
      className={`relative text-left rounded-[14px] p-3 border-2 transition-all ${
        selected
          ? 'bg-rider/8 border-rider'
          : 'bg-surface border-transparent'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-[18px] h-[18px] bg-rider rounded-full flex items-center justify-center">
          <span className="text-bg text-[11px] font-black">{'\u2713'}</span>
        </div>
      )}
      <div className="text-[26px] mb-1">{meta.emoji}</div>
      <div className="font-black text-[14px] text-text tracking-[-0.01em]">{meta.label}</div>
      <div className="text-[10px] text-text-dim mt-0.5">{meta.subtitle}</div>
    </button>
  )
}
