import { Fragment } from 'react'
import { CATEGORY_META } from '@/lib/suggestions'
import type { BetTemplate } from '@/lib/suggestions'

/** Render template title with {slot} values as green chips */
function TitleWithSlots({ template }: { template: BetTemplate }) {
  if (!template.templateSlots?.length) {
    // No slots — render plain title with defaults already resolved
    let text = template.title
    if (template.templateSlots) {
      for (const slot of template.templateSlots) text = text.replace(`{${slot.key}}`, String(slot.default))
    }
    return <>{text}</>
  }
  const source = template.template ?? template.title
  const parts = source.split(/(\{[^}]+\})/)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\{(.+)\}$/)
        if (!match) return <Fragment key={i}>{part}</Fragment>
        const key = match[1]
        const slot = template.templateSlots!.find((s) => s.key === key)
        const val = slot ? String(slot.default) : key
        return (
          <span
            key={i}
            className="inline-block bg-accent-green/15 text-accent-green font-black px-1 rounded border border-dashed border-accent-green/40 mx-0.5 font-mono text-[11px]"
          >
            {val}
          </span>
        )
      })}
    </>
  )
}

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
          <TitleWithSlots template={template} />
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
