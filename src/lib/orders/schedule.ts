import { formatDateShort } from '@/lib/utils'
import type { OrderTypeValue } from '@/lib/validation/schemas'

/**
 * Advance-order scheduling.
 *
 * The shop serves two windows a day: breakfast in the morning and the 4PM
 * snack. A breakfast ordered once the 4PM cutoff has passed can no longer be
 * part of today's service, so it is booked for TOMORROW morning and flagged as
 * an advance order.
 *
 * These helpers run in the browser (to warn the customer before they submit)
 * and on the server (which decides authoritatively at order creation).
 *
 * Asia/Manila is UTC+08:00 all year round — the Philippines has not observed
 * daylight saving since 1978 — so a fixed offset is exact here and lets us
 * convert in both directions without a date library.
 */

const PH_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Manila hour from which the day's breakfast window is closed to new orders. */
export const BREAKFAST_CUTOFF_HOUR = 16

/** How the cutoff is spelled out to customers. */
export const BREAKFAST_CUTOFF_LABEL = '4:00 PM'

/**
 * Shifts an instant so that reading its UTC fields gives Manila wall-clock
 * fields. The returned Date is only ever used through its getUTC* accessors.
 */
function phWallClock(instant: Date): Date {
  return new Date(instant.getTime() + PH_OFFSET_MS)
}

/** Hour of day (0–23) in Philippine time. */
export function phHour(instant: Date): number {
  return phWallClock(instant).getUTCHours()
}

/** YYYY-MM-DD of the Philippine calendar day an instant falls in. */
export function phDayKey(instant: Date): string {
  return phWallClock(instant).toISOString().slice(0, 10)
}

/** The instant at which Manila midnight begins on the day `instant` falls in. */
export function phStartOfDay(instant: Date): Date {
  const wall = phWallClock(instant)
  return new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - PH_OFFSET_MS,
  )
}

/** Same clock time, `days` later. Safe to do arithmetically: PH has no DST. */
export function phAddDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS)
}

export type OrderSchedule = {
  /** True when the order is not for today's service. */
  isAdvance: boolean
  /**
   * Manila midnight of the service day. Null for a customer-chosen ADVANCE
   * order, where the wanted date lives in the order notes.
   */
  scheduledFor: Date | null
}

/**
 * True when a breakfast ordered at `now` belongs to tomorrow morning rather
 * than today's — i.e. it is being placed at or after the 4PM cutoff.
 */
export function rollsOverToTomorrow(orderType: OrderTypeValue, now: Date = new Date()): boolean {
  return orderType === 'BREAKFAST' && phHour(now) >= BREAKFAST_CUTOFF_HOUR
}

/** Which service day an order placed at `now` is for, and whether it is advance. */
export function resolveOrderSchedule(
  orderType: OrderTypeValue,
  now: Date = new Date(),
): OrderSchedule {
  // An explicitly advance order carries its date in the customer's notes.
  if (orderType === 'ADVANCE') return { isAdvance: true, scheduledFor: null }

  const today = phStartOfDay(now)
  if (rollsOverToTomorrow(orderType, now)) {
    return { isAdvance: true, scheduledFor: phAddDays(today, 1) }
  }
  return { isAdvance: false, scheduledFor: today }
}

/** "Today", "Tomorrow", or "Sep 8, 2026" — always read in Philippine time. */
export function describeServiceDay(
  scheduledFor: Date | string | null,
  now: Date = new Date(),
): string {
  if (!scheduledFor) return 'Date in notes'
  const date = new Date(scheduledFor)
  const key = phDayKey(date)
  if (key === phDayKey(now)) return 'Today'
  if (key === phDayKey(phAddDays(now, 1))) return 'Tomorrow'
  if (key === phDayKey(phAddDays(now, -1))) return 'Yesterday'
  return formatDateShort(date)
}

/**
 * Full description used on order pages: "Morning Breakfast · Tomorrow
 * (Sep 8, 2026)" style, without repeating the day twice when it is a plain date.
 */
export function describeServiceDayLong(
  scheduledFor: Date | string | null,
  now: Date = new Date(),
): string {
  if (!scheduledFor) return 'Date in notes'
  const date = new Date(scheduledFor)
  const relative = describeServiceDay(date, now)
  const absolute = formatDateShort(date)
  return relative === absolute ? absolute : `${relative} (${absolute})`
}
