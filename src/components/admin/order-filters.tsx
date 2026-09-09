'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/field'
import {
  FULFILLMENT_PERIODS,
  FULFILLMENT_PERIOD_LABELS,
  ORDER_STATUSES,
} from '@/lib/validation/schemas'
import { STATUS_META } from './order-status-badge'

/**
 * Search / status / fulfillment filters. All state lives in the URL so the
 * list is a plain server-rendered page — shareable, bookmarkable, and cheap
 * to re-render. The `fdate` preset (today/tomorrow) is a shortcut over the
 * `from`/`to` fields, which continue to accept a custom date range.
 */
export function OrderFilters({
  q,
  status,
  fdate,
  period,
  from,
  to,
  view,
}: {
  q: string
  status: string
  fdate: string
  period: string
  from: string
  to: string
  /** Active tab. Preserved by Clear, which only drops the search filters. */
  view?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [term, setTerm] = React.useState(q)

  const [renderedQuery, setRenderedQuery] = React.useState(q)
  if (renderedQuery !== q) {
    setRenderedQuery(q)
    setTerm(q)
  }

  const apply = React.useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.delete('page')
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams],
  )

  // Picking a preset (today/tomorrow) clears the custom date fields, and
  // typing in a custom date field clears the preset, so the two never fight.
  const setPreset = React.useCallback(
    (value: string) => {
      apply({ fdate: value || undefined, from: undefined, to: undefined })
    },
    [apply],
  )

  React.useEffect(() => {
    if (term === q) return
    const timer = setTimeout(() => apply({ q: term || undefined }), 350)
    return () => clearTimeout(timer)
  }, [term, q, apply])

  const hasFilters = Boolean(q || status || fdate || period || from || to)

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search order number, name or phone"
          aria-label="Search orders"
          type="search"
          enterKeyHint="search"
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          value={status}
          aria-label="Filter by status"
          onChange={(event) => apply({ status: event.target.value || undefined })}
          className="py-2.5 text-sm"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_META[value].label}
            </option>
          ))}
        </Select>

        <Select
          value={period}
          aria-label="Filter by fulfillment period"
          onChange={(event) => apply({ period: event.target.value || undefined })}
          className="py-2.5 text-sm"
        >
          <option value="">All periods</option>
          {FULFILLMENT_PERIODS.map((value) => (
            <option key={value} value={value}>
              {FULFILLMENT_PERIOD_LABELS[value]}
            </option>
          ))}
        </Select>

        <Select
          value={fdate}
          aria-label="Fulfillment date"
          onChange={(event) => setPreset(event.target.value)}
          className="py-2.5 text-sm"
        >
          <option value="">Any fulfillment date</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          {from || to ? <option value="custom">Custom range</option> : null}
        </Select>

        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              router.push(view && view !== 'all' ? `${pathname}?view=${view}` : pathname)
            }
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-semibold text-ink-500 ring-1 ring-cream-200 transition-colors hover:text-chili-600"
          >
            <X className="size-4" />
            Clear
          </button>
        ) : (
          <div className="hidden sm:block" aria-hidden />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input
          type="date"
          value={from}
          max={to || undefined}
          aria-label="Fulfillment date from"
          onChange={(event) => apply({ from: event.target.value || undefined, fdate: undefined })}
          className="py-2.5 text-sm"
        />

        <Input
          type="date"
          value={to}
          min={from || undefined}
          aria-label="Fulfillment date to"
          onChange={(event) => apply({ to: event.target.value || undefined, fdate: undefined })}
          className="py-2.5 text-sm"
        />
      </div>
    </div>
  )
}
