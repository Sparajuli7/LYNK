import { CATEGORY_META, resolveTitle } from '@/lib/suggestions'
import type { BetTemplate } from '@/lib/suggestions'

interface SuggestionRowProps {
  template: BetTemplate
  subtitle?: string
  onUse: (template: BetTemplate) => void
  highlight?: boolean
}

export function SuggestionRow({ template, subtitle, onUse, highlight = false }: SuggestionRowProps) {
  const meta = CATEGORY_META[template.category]
  const defaultSubtitle = `${meta.label} ${'\u00B7'} ${template.suggestedFormat === '1v1' ? '1v1' : 'Group'} ${'\u00B7'} ~$${template.suggestedStakeCents / 100}`

  return (
    <div className="bg-surface rounded-[10px] p-2.5 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-base shrink-0">
        {template.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black text-[12px] text-text leading-[1.2]">
          {resolveTitle(template)}
        </div>
        <div className="text-[9px] text-text-dim mt-0.5">
          {subtitle ?? defaultSubtitle}
        </div>
      </div>
      <button
        onClick={() => onUse(template)}
        className={`shrink-0 font-black text-[10px] px-2.5 py-1 rounded-lg tracking-[0.08em] border-[1.5px] transition-all ${
          highlight
            ? 'bg-rider-dim border-rider text-rider'
            : 'bg-transparent border-[#333] text-[#ccc]'
        }`}
      >
        + USE
      </button>
    </div>
  )
}
