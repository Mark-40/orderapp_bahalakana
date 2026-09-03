'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CategoryTab = { id: string; name: string; count: number }

/**
 * Horizontally scrolling category strip. Selecting a tab scrolls to that
 * section, and scrolling the page highlights the section you're in — so the
 * strip works both as navigation and as a position indicator.
 */
export function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: CategoryTab[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const listRef = React.useRef<HTMLDivElement>(null)

  // Keep the active chip in view when the highlight moves as the page scrolls.
  React.useEffect(() => {
    if (!activeId || !listRef.current) return
    const chip = listRef.current.querySelector<HTMLElement>(`[data-tab="${activeId}"]`)
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeId])

  if (categories.length === 0) return null

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Menu categories"
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
    >
      {categories.map((category) => {
        const active = category.id === activeId
        return (
          <button
            key={category.id}
            data-tab={category.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onSelect(category.id)}
            className={cn(
              'min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-all',
              active
                ? 'bg-brand-gradient text-white shadow-[var(--shadow-glow)]'
                : 'bg-white/90 text-ink-700 ring-1 ring-cream-200 hover:bg-white',
            )}
          >
            {category.name}
            <span className={cn('ml-1.5 text-xs', active ? 'text-white/80' : 'text-ink-300')}>
              {category.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
