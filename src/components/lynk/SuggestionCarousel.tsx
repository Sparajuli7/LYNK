import { SuggestionCard } from './SuggestionCard'
import type { RankedSuggestion } from '@/lib/suggestions'

interface SuggestionCarouselProps {
  suggestions: RankedSuggestion[]
  onUse: (suggestion: RankedSuggestion) => void
  onLongPress?: (suggestion: RankedSuggestion) => void
  isLoading?: boolean
}

function SkeletonCard() {
  return (
    <div className="shrink-0 w-[65%] bg-surface border-[1.5px] border-[#333] rounded-xl p-2.5 animate-pulse">
      <div className="h-2 w-24 bg-[#333] rounded mb-3" />
      <div className="h-4 w-full bg-[#333] rounded mb-2" />
      <div className="h-3 w-2/3 bg-[#333] rounded mb-3" />
      <div className="flex justify-between items-center">
        <div className="h-2 w-20 bg-[#333] rounded" />
        <div className="h-6 w-14 bg-[#333] rounded-lg" />
      </div>
    </div>
  )
}

export function SuggestionCarousel({
  suggestions,
  onUse,
  onLongPress,
  isLoading,
}: SuggestionCarouselProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-6 text-text-mute text-[12px]">
        No suggestions available
      </div>
    )
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 snap-x snap-mandatory">
      {suggestions.map((s) => (
        <SuggestionCard
          key={s.template.id}
          suggestion={s}
          onUse={onUse}
          onLongPress={onLongPress}
        />
      ))}
      {/* Peek element */}
      <div className="shrink-0 w-[12%] bg-surface rounded-xl opacity-50" />
    </div>
  )
}
