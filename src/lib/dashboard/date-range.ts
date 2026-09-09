import { phAddDays, phDayKey, phStartOfDay } from '@/lib/orders/schedule'

/**
 * Date-range resolution for the admin dashboard.
 *
 * All bounds are computed in Philippine time. The server may run in UTC
 * (Vercel), but the shop operates on the PH calendar, so "today" here always
 * means "the current PH day", not the server's local day. Bounds returned by
 * this module are the exact instants of PH midnight and PH midnight-of-next-day
 * (exclusive upper bound style would be cleaner, but callers use `lte`, so we
 * return the last-millisecond form for compatibility).
 */

export type RangeKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom'

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
]

export type DateRange = { from: Date; to: Date; key: RangeKey; label: string }

/** PH midnight of the PH day this instant falls in. */
export function startOfDay(date: Date): Date {
  return phStartOfDay(date)
}

/** Last millisecond of the PH day this instant falls in. */
export function endOfDay(date: Date): Date {
  const start = phStartOfDay(date)
  return new Date(phAddDays(start, 1).getTime() - 1)
}

function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  // Interpret the YYYY-MM-DD as a PH-calendar date. Anchor at PH noon so no
  // rounding lands on the previous day when converted to a PH-midnight bound.
  const noonPh = new Date(Date.UTC(y, m - 1, d, 12) - 8 * 60 * 60 * 1000)
  return Number.isNaN(noonPh.getTime()) ? null : noonPh
}

/** YYYY-MM-DD in PH time — the format `<input type="date">` expects. */
export function toDateInputValue(date: Date): string {
  return phDayKey(date)
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
      const y = phAddDays(now, -1)
      return { from: startOfDay(y), to: endOfDay(y), key: 'yesterday', label: 'Yesterday' }
    }
    case 'last7':
      return {
        from: startOfDay(phAddDays(now, -6)),
        to: endOfDay(now),
        key: 'last7',
        label: 'Last 7 days',
      }
    case 'last30':
      return {
        from: startOfDay(phAddDays(now, -29)),
        to: endOfDay(now),
        key: 'last30',
        label: 'Last 30 days',
      }
    default:
      return { from: startOfDay(now), to: endOfDay(now), key: 'today', label: 'Today' }
  }
}
