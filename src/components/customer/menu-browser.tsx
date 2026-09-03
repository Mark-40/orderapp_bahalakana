'use client'

import * as React from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { EmptyState } from '@/components/ui/states'
import { CategoryTabs } from './category-tabs'
import { MenuCard, type MenuCardItem } from './menu-card'

export type MenuCategory = {
  id: string
  name: string
  description: string | null
  items: MenuCardItem[]
}

/** Purely decorative fallback art when an item has no image. */
const EMOJI_BY_CATEGORY: Record<string, string> = {
  breakfast: '🍳',
  snacks: '🍟',
  snack: '🍟',
  drinks: '☕',
  drink: '🥤',
  desserts: '🍰',
  dessert: '🍰',
  meals: '🍛',
  rice: '🍚',
  'add-ons': '🥚',
  'add ons': '🥚',
  addons: '🥚',
}

function emojiFor(name: string): string {
  return EMOJI_BY_CATEGORY[name.trim().toLowerCase()] ?? '🍽️'
}

/**
 * Renders every category as a section on one scrollable page — faster than
 * filtering, and it lets people browse the whole menu with one thumb. The
 * category strip both jumps to a section and tracks which one is on screen.
 */
export function MenuBrowser({ categories }: { categories: MenuCategory[] }) {
  const [activeId, setActiveId] = React.useState<string | null>(categories[0]?.id ?? null)
  const sectionRefs = React.useRef(new Map<string, HTMLElement>())
  // Suppresses scroll-spy while a tap-triggered smooth scroll is in flight,
  // otherwise passing sections would fight the tapped selection.
  const jumpingTo = React.useRef<string | null>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (!visible) return

        const id = visible.target.getAttribute('data-section-id')
        if (!id) return

        if (jumpingTo.current) {
          if (jumpingTo.current === id) jumpingTo.current = null
          return
        }
        setActiveId(id)
      },
      // Top band only, just under the sticky header.
      { rootMargin: '-140px 0px -65% 0px', threshold: 0 },
    )

    for (const element of sectionRefs.current.values()) observer.observe(element)
    return () => observer.disconnect()
  }, [categories])

  function handleSelect(id: string) {
    jumpingTo.current = id
    setActiveId(id)
    const element = sectionRefs.current.get(id)
    if (!element) return
    const top = element.getBoundingClientRect().top + window.scrollY - 124
    window.scrollTo({ top, behavior: 'smooth' })
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        icon={<UtensilsCrossed className="size-6" />}
        title="The menu is being prepared"
        description="Nothing is listed just yet. Please check back a little later."
      />
    )
  }

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 border-b border-white/60 bg-white/70 px-4 py-2 shadow-[0_4px_20px_-14px_rgba(28,19,48,0.3)] backdrop-blur-md">
        <CategoryTabs
          categories={categories.map((c) => ({ id: c.id, name: c.name, count: c.items.length }))}
          activeId={activeId}
          onSelect={handleSelect}
        />
      </div>

      <div className="space-y-8 pt-5">
        {categories.map((category) => (
          <section
            key={category.id}
            data-section-id={category.id}
            ref={(node) => {
              if (node) sectionRefs.current.set(category.id, node)
              else sectionRefs.current.delete(category.id)
            }}
            aria-labelledby={`heading-${category.id}`}
            className="scroll-mt-32"
          >
            <div className="mb-3 flex items-baseline gap-2">
              <span aria-hidden className="text-xl">
                {emojiFor(category.name)}
              </span>
              <div className="min-w-0">
                <h2
                  id={`heading-${category.id}`}
                  className="text-xl leading-tight font-extrabold text-ink-900"
                >
                  {category.name}
                </h2>
                {category.description ? (
                  <p className="mt-0.5 text-sm text-ink-500">{category.description}</p>
                ) : null}
              </div>
            </div>

            {category.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cream-200 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
                Nothing in {category.name} right now.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {category.items.map((item) => (
                  <MenuCard key={item.id} item={item} categoryEmoji={emojiFor(category.name)} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
