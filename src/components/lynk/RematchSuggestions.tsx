import { useMemo } from 'react'
import { formatMoney } from '@/lib/utils/formatters'
import { getAllTemplates, getTemplatesByCategory } from '@/lib/suggestions/catalog'
import type { BetTemplate, BetCategory } from '@/lib/suggestions/types'

interface RematchSuggestionsProps {
  /** The original bet that was lost */
  originalTitle: string
  originalCategory: BetCategory
  originalStakeCents: number
  originalDurationDays: number
  /** Opponent name for context */
  opponentName?: string
  /** Called when user picks a variant */
  onSelect: (data: { title: string; stakeCents: number; durationDays: number }) => void
}

/**
 * Computes 3 rematch variants from the catalog:
 * 1. Mirror — same bet, same stakes
 * 2. Easier — same category, eased slot values or lower stake
 * 3. Different — random pick from a different category
 */
export function RematchSuggestions({
  originalTitle,
  originalCategory,
  originalStakeCents,
  originalDurationDays,
  opponentName,
  onSelect,
}: RematchSuggestionsProps) {
  const variants = useMemo(() => {
    const categoryTemplates = getTemplatesByCategory(originalCategory)
    const allTemplates = getAllTemplates()

    // 1. Mirror — same bet, same stakes
    const mirror = {
      label: 'SAME BET',
      sublabel: 'Run it back. Same stakes.',
      title: originalTitle,
      stakeCents: originalStakeCents,
      durationDays: originalDurationDays,
      borderColor: 'border-rider/25',
      labelColor: 'text-rider',
      emoji: '🔄',
    }

    // 2. Easier — find a template in same category with lower stake or easier slots
    let easierTemplate: BetTemplate | undefined
    const sorted = [...categoryTemplates]
      .filter((t) => t.suggestedStakeCents <= originalStakeCents && t.title !== originalTitle)
      .sort((a, b) => b.popularityScore - a.popularityScore)
    easierTemplate = sorted[0]

    const easier = easierTemplate
      ? {
          label: 'EASIER VARIANT',
          sublabel: 'Same vibe, lower stakes.',
          title: easierTemplate.title,
          stakeCents: Math.min(easierTemplate.suggestedStakeCents, Math.round(originalStakeCents * 0.5)),
          durationDays: easierTemplate.suggestedDurationDays,
          borderColor: 'border-warning/25',
          labelColor: 'text-warning',
          emoji: '📉',
        }
      : {
          label: 'EASIER VARIANT',
          sublabel: 'Half the stakes this time.',
          title: originalTitle,
          stakeCents: Math.round(originalStakeCents * 0.5),
          durationDays: originalDurationDays,
          borderColor: 'border-warning/25',
          labelColor: 'text-warning',
          emoji: '📉',
        }

    // 3. Different category — random popular pick from another category
    const otherCategories = (['fitness', 'habits', 'party', 'dares', 'family', 'goals', 'couples', 'travel'] as BetCategory[])
      .filter((c) => c !== originalCategory)
    const randomCat = otherCategories[Math.floor(Math.random() * otherCategories.length)]
    const diffTemplates = getTemplatesByCategory(randomCat)
      .filter((t) => !t.matureFlag)
      .sort((a, b) => b.popularityScore - a.popularityScore)
    const diffTemplate = diffTemplates[0] ?? allTemplates.find((t) => t.category !== originalCategory)

    const different = diffTemplate
      ? {
          label: 'SWITCH IT UP',
          sublabel: `Try ${randomCat} instead.`,
          title: diffTemplate.title,
          stakeCents: diffTemplate.suggestedStakeCents,
          durationDays: diffTemplate.suggestedDurationDays,
          borderColor: 'border-doubter/25',
          labelColor: 'text-doubter',
          emoji: '🎲',
        }
      : {
          label: 'SWITCH IT UP',
          sublabel: 'Something completely different.',
          title: 'Pick something new from Browse',
          stakeCents: originalStakeCents,
          durationDays: 7,
          borderColor: 'border-doubter/25',
          labelColor: 'text-doubter',
          emoji: '🎲',
        }

    return [mirror, easier, different]
  }, [originalTitle, originalCategory, originalStakeCents, originalDurationDays])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-doubter text-[10px]">⚔</span>
        <span className="font-black italic text-[13px] text-doubter tracking-[0.15em]">
          REMATCH OPTIONS
        </span>
      </div>
      {opponentName && (
        <p className="text-[10px] text-text-dim mb-2">
          Pick your revenge against {opponentName}
        </p>
      )}
      {variants.map((v, i) => (
        <button
          key={i}
          onClick={() => onSelect({ title: v.title, stakeCents: v.stakeCents, durationDays: v.durationDays })}
          className={`w-full bg-surface border-[1.5px] ${v.borderColor} rounded-xl p-3 text-left transition-all active:scale-[0.98]`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]">{v.emoji}</span>
              <span className={`font-mono text-[8px] font-black tracking-[0.15em] ${v.labelColor}`}>
                {v.label}
              </span>
            </div>
            <span className="font-mono text-[10px] text-text-mute">
              {formatMoney(v.stakeCents)} · {v.durationDays}d
            </span>
          </div>
          <div className="font-black text-[13px] text-text leading-tight tracking-[-0.01em] mb-0.5">
            {v.title}
          </div>
          <div className="text-[9px] text-text-dim">{v.sublabel}</div>
        </button>
      ))}
    </div>
  )
}
