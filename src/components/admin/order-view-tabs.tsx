import Link from 'next/link'
import { CalendarClock, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderViewValue } from '@/lib/validation/schemas'

/**
 * All orders / Advance orders. The tab is just another URL parameter, so the
 * list stays a plain server-rendered page and every other filter carries over
 * when the tab changes.
 */
export function OrderViewTabs({
  active,
  query,
  counts,
}: {
  active: OrderViewValue
  /** Current filters, minus `view` and `page`, preserved across tabs. */
  query: Record<string, string | undefined>
  counts: { all: number; advance: number }
}) {
  const tabs = [
    { view: 'all' as const, label: 'All orders', icon: Receipt, count: counts.all },
    { view: 'advance' as const, label: 'Advance orders', icon: CalendarClock, count: counts.advance },
  ]

  return (
    <div
      role="tablist"
      aria-label="Order views"
      className="flex gap-1.5 overflow-x-auto rounded-xl bg-cream-100 p-1"
    >
      {tabs.map((tab) => {
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(query)) {
          if (value) params.set(key, value)
        }
        if (tab.view !== 'all') params.set('view', tab.view)
        const search = params.toString()
        const selected = active === tab.view

        return (
          <Link
            key={tab.view}
            role="tab"
            aria-selected={selected}
            href={search ? `/admin/orders?${search}` : '/admin/orders'}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors',
              selected
                ? 'bg-white text-brand-700 shadow-[var(--shadow-soft)]'
                : 'text-ink-500 hover:text-ink-900',
            )}
          >
            <tab.icon className="size-4 shrink-0" />
            {tab.label}
            <span
              className={cn(
                'tabular rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                selected ? 'bg-brand-50 text-brand-700' : 'bg-white text-ink-500',
              )}
            >
              {tab.count}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
