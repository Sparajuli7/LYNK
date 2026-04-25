import { useRef, useEffect } from 'react'
import { CATEGORY_META, ALL_CATEGORIES, type BetCategory } from '@/lib/suggestions'

interface CategoryPillBarProps {
  selected: BetCategory | null
  onSelect: (category: BetCategory | null) => void
  /** Label for the "all" pill. Default: "SMART PICKS" */
  allLabel?: string
  /** Show category emoji only (compact mode for Browse) */
  compact?: boolean
}

export function CategoryPillBar({
  selected,
  onSelect,
  allLabel = 'SMART PICKS',
  compact = false,
}: CategoryPillBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selected || !scrollRef.current) return
    const idx = ALL_CATEGORIES.indexOf(selected)
    const pill = scrollRef.current.children[idx + 1] as HTMLElement | undefined
    pill?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selected])

  const base = 'shrink-0 font-bold text-[10px] border-[1.5px] rounded-[14px] whitespace-nowrap transition-all'
  const active = 'bg-rider text-bg border-rider font-black'
  const inactive = 'bg-transparent border-[#333] text-[#ccc]'

  return (
    <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`${base} px-2.5 py-1.5 tracking-[0.08em] ${selected === null ? active : inactive}`}
      >
        {allLabel}
      </button>
      {ALL_CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat]
        const isActive = selected === cat
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`${base} px-2.5 py-1.5 tracking-[0.08em] ${isActive ? active : inactive}`}
          >
            {compact ? meta.emoji : `${meta.emoji} ${meta.label.toUpperCase()}`}
          </button>
        )
      })}
    </div>
  )
}
