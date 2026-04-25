import { CATEGORY_META, ALL_CATEGORIES, type BetCategory } from '@/lib/suggestions'

interface ShuffleBlockProps {
  /** Categories the user hasn't bet on yet */
  unusedCategories?: BetCategory[]
  onCategoryTap: (category: BetCategory) => void
  onSurpriseMe: () => void
}

export function ShuffleBlock({ unusedCategories, onCategoryTap, onSurpriseMe }: ShuffleBlockProps) {
  const cats = unusedCategories && unusedCategories.length > 0
    ? unusedCategories.slice(0, 3)
    : ALL_CATEGORIES.slice(0, 3)

  return (
    <div className="bg-surface border-[1.5px] border-rider/20 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px]">{'\uD83C\uDFB2'}</span>
        <span className="font-black italic text-[12px] text-text tracking-[0.1em]">
          SHUFFLE {'\u2014'} TRY SOMETHING NEW
        </span>
      </div>
      <p className="text-[11px] text-text-dim mb-2.5 leading-[1.4]">
        Get a random pick from a category you haven't bet on yet.
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {cats.map((cat) => {
          const meta = CATEGORY_META[cat]
          return (
            <button
              key={cat}
              onClick={() => onCategoryTap(cat)}
              className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-bold text-[10px] px-2.5 py-1 rounded-xl tracking-[0.08em]"
            >
              {meta.emoji} {meta.label.toUpperCase()}
            </button>
          )
        })}
        <button
          onClick={onSurpriseMe}
          className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-bold text-[10px] px-2.5 py-1 rounded-xl tracking-[0.08em]"
        >
          {'\uD83C\uDFB2'} SURPRISE ME
        </button>
      </div>
    </div>
  )
}
