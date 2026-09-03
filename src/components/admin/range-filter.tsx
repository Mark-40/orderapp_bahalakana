'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/field'
import { RANGE_OPTIONS, type RangeKey } from '@/lib/dashboard/date-range'
import { cn } from '@/lib/utils'

/**
 * Date-range chips that drive the page through the URL, so a filtered view can
 * be bookmarked, shared, or reloaded and still show the same numbers.
 */
export function RangeFilter({
  activeKey,
  from,
  to,
}: {
  activeKey: RangeKey
  from: string
  to: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showCustom, setShowCustom] = React.useState(activeKey === 'custom')

  function apply(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    // Any filter change resets to the first page of results.
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function selectRange(key: RangeKey) {
    if (key === 'custom') {
      setShowCustom(true)
      apply({ range: 'custom', from, to })
      return
    }
    setShowCustom(false)
    apply({ range: key, from: undefined, to: undefined })
  }

  return (
    <div className="space-y-2">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {RANGE_OPTIONS.map((option) => {
          const active = option.key === activeKey
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => selectRange(option.key)}
              aria-pressed={active}
              className={cn(
                'min-h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors',
                active
                  ? 'bg-ink-900 text-cream-50'
                  : 'bg-white text-ink-700 ring-1 ring-cream-200 hover:bg-cream-50',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {showCustom || activeKey === 'custom' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-36 text-xs font-semibold text-ink-500">
            From
            <Input
              type="date"
              defaultValue={from}
              max={to}
              className="mt-1 py-2 text-sm"
              onChange={(event) => apply({ range: 'custom', from: event.target.value, to })}
            />
          </label>
          <label className="flex-1 min-w-36 text-xs font-semibold text-ink-500">
            To
            <Input
              type="date"
              defaultValue={to}
              min={from}
              className="mt-1 py-2 text-sm"
              onChange={(event) => apply({ range: 'custom', from, to: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
