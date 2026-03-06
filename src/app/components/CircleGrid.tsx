import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// CircleGrid — reusable 3-column grid of circular items with labels
// Inspired by the "Follow Teams" pattern: circle icon + label underneath.
// ---------------------------------------------------------------------------

export interface CircleGridItem {
  id: string
  /** Large emoji, icon, or image shown inside the circle */
  icon: ReactNode
  /** Primary label shown below the circle */
  label: string
  /** Optional secondary label (smaller, muted) */
  sublabel?: string
}

interface CircleGridProps {
  items: CircleGridItem[]
  onItemClick: (id: string) => void
  /** Number of columns (default 3) */
  columns?: 3 | 4
  /** Size of each circle: 'md' = 72px, 'lg' = 80px (default 'md') */
  size?: 'md' | 'lg'
  /** Max lines for the label (default 1). Use 2 for longer text like bet titles. */
  labelLines?: 1 | 2
  /** IDs of items that are currently pinned — shows a ⭐ overlay when provided */
  pinnedIds?: Set<string>
  /** Called when the user taps the pin button on an item */
  onPinItem?: (id: string) => void
}

export function CircleGrid({
  items,
  onItemClick,
  columns = 3,
  size = 'md',
  labelLines = 1,
  pinnedIds,
  onPinItem,
}: CircleGridProps) {
  const gridCols = columns === 4 ? 'grid-cols-4' : 'grid-cols-3'
  const circleSize = size === 'lg' ? 'w-20 h-20' : 'w-[72px] h-[72px]'
  const iconSize = size === 'lg' ? 'text-3xl' : 'text-2xl'
  const clampClass = labelLines === 2 ? 'line-clamp-2' : 'line-clamp-1'

  return (
    <div className={`grid ${gridCols} gap-y-5 gap-x-3`}>
      {items.map((item) => {
        const isPinned = pinnedIds?.has(item.id) ?? false
        return (
          <div key={item.id} className="flex flex-col items-center gap-1.5">
            {/* Circle with optional pin overlay */}
            <div className="relative">
              <button
                onClick={() => onItemClick(item.id)}
                className={`${circleSize} rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center transition-all hover:bg-bg-card hover:border-accent-green/40 active:scale-95`}
              >
                <span className={iconSize}>{item.icon}</span>
              </button>
              {onPinItem && (
                <button
                  onClick={() => onPinItem(item.id)}
                  className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                  aria-label={isPinned ? 'Unpin' : 'Pin'}
                >
                  <span className="text-[9px] leading-none">{isPinned ? '★' : '☆'}</span>
                </button>
              )}
            </div>
            {/* Label — also clickable */}
            <button onClick={() => onItemClick(item.id)} className="text-center w-full">
              <span className={`text-[11px] font-semibold text-text-primary text-center leading-tight ${clampClass} max-w-full px-0.5 block`}>
                {item.label}
              </span>
              {item.sublabel && (
                <span className="text-[10px] text-text-muted block">{item.sublabel}</span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
