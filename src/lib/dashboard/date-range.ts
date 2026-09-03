export type RangeKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom'

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
]

export type DateRange = { from: Date; to: Date; key: RangeKey; label: string }

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

/** YYYY-MM-DD in local time, the format <input type="date"> expects. */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function resolveRange(
  key: string | undefined,
  from?: string,
  to?: string,
  now: Date = new Date(),
): DateRange {
  const customFrom = parseDateInput(from)
  const customTo = parseDateInput(to)

  if (key === 'custom' || (!key && (customFrom || customTo))) {
    const start = startOfDay(customFrom ?? customTo ?? now)
    const end = endOfDay(customTo ?? customFrom ?? now)
    return {
      from: start <= end ? start : end,
      to: start <= end ? end : start,
      key: 'custom',
      label: 'Custom range',
    }
  }

  switch (key) {
    case 'yesterday': {
      const y = addDays(now, -1)
      return { from: startOfDay(y), to: endOfDay(y), key: 'yesterday', label: 'Yesterday' }
    }
    case 'last7':
      return {
        from: startOfDay(addDays(now, -6)),
        to: endOfDay(now),
        key: 'last7',
        label: 'Last 7 days',
      }
    case 'last30':
      return {
        from: startOfDay(addDays(now, -29)),
        to: endOfDay(now),
        key: 'last30',
        label: 'Last 30 days',
      }
    default:
      return { from: startOfDay(now), to: endOfDay(now), key: 'today', label: 'Today' }
  }
}
