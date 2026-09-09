import { formatDateShort } from '@/lib/utils'

/**
 * Fulfillment scheduling.
 *
 * The shop serves two windows a day — breakfast in the morning, snack at 4PM.
 * Customers pick from a short list of upcoming SLOTS at checkout: today's
 * remaining window(s) plus both of tomorrow's. Every slot resolves to an
 * explicit (fulfillmentDate, fulfillmentPeriod) pair that the server stores
 * on the order, so an order created yesterday for today still shows up in
 * today's fulfillment views.
 *
 * These helpers run in the browser (so customers see only the slots they can
 * still book) and on the server (which decides authoritatively at submission,
 * so a hand-crafted request cannot book a slot that has already closed).
 *
 * Asia/Manila is UTC+08:00 all year round — the Philippines has not observed
 * daylight saving since 1978 — so a fixed offset is exact here and lets us
 * convert in both directions without a date library.
 */

const PH_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// Cutoff hours are in Philippine wall-clock time.
export const BREAKFAST_CUTOFF_HOUR = 8 // Today's breakfast closes at 8:00 AM.
export const SNACK_CUTOFF_HOUR = 15 // Today's snack closes at 3:00 PM.

/** Shifts an instant so that reading its UTC fields gives PH wall-clock fields. */
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

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

export type FulfillmentPeriod = 'BREAKFAST' | 'SNACK'

export const FULFILLMENT_PERIODS = ['BREAKFAST', 'SNACK'] as const

export const PERIOD_LABELS: Record<FulfillmentPeriod, string> = {
  BREAKFAST: 'Morning Breakfast',
  SNACK: '4PM Snack',
}

/** Stable ids for the four slots a customer can pick at checkout. */
export const SLOT_IDS = [
  'TODAY_BREAKFAST',
  'TODAY_SNACK',
  'TOMORROW_BREAKFAST',
  'TOMORROW_SNACK',
] as const
export type SlotId = (typeof SLOT_IDS)[number]

export type Slot = {
  id: SlotId
  period: FulfillmentPeriod
  /** PH midnight of the day this slot is for. */
  date: Date
  /** True when `date` is not the current PH day. */
  isAdvance: boolean
  /** "Today – Morning Breakfast", etc. Reader-facing. */
  label: string
}

const SLOT_TABLE: Array<{
  id: SlotId
  period: FulfillmentPeriod
  /** Which PH-day offset this slot belongs to (0 = today, 1 = tomorrow). */
  dayOffset: 0 | 1
  /** Cutoff hour (PH). At or after this hour on the slot's day, the slot is
   *  closed to new bookings. `null` = open until midnight. */
  cutoffHour: number | null
  labelPrefix: 'Today' | 'Tomorrow'
}> = [
  { id: 'TODAY_BREAKFAST',    period: 'BREAKFAST', dayOffset: 0, cutoffHour: BREAKFAST_CUTOFF_HOUR, labelPrefix: 'Today' },
  { id: 'TODAY_SNACK',        period: 'SNACK',     dayOffset: 0, cutoffHour: SNACK_CUTOFF_HOUR,     labelPrefix: 'Today' },
  { id: 'TOMORROW_BREAKFAST', period: 'BREAKFAST', dayOffset: 1, cutoffHour: null,                  labelPrefix: 'Tomorrow' },
  { id: 'TOMORROW_SNACK',     period: 'SNACK',     dayOffset: 1, cutoffHour: null,                  labelPrefix: 'Tomorrow' },
]

function buildSlot(entry: (typeof SLOT_TABLE)[number], now: Date): Slot {
  const today = phStartOfDay(now)
  const date = entry.dayOffset === 0 ? today : phAddDays(today, 1)
  return {
    id: entry.id,
    period: entry.period,
    date,
    isAdvance: entry.dayOffset !== 0,
    label: `${entry.labelPrefix} – ${PERIOD_LABELS[entry.period]}`,
  }
}

/** True if the given slot is still bookable at `now` (PH clock). */
export function isSlotAvailable(id: SlotId, now: Date = new Date()): boolean {
  const entry = SLOT_TABLE.find((e) => e.id === id)
  if (!entry) return false
  if (entry.cutoffHour === null) return true
  // Today's slots only make sense if we're still before their cutoff and still
  // on the same PH day as `now`. (Being past midnight already places `now`
  // into a new PH day, so the "today" slot for the previous PH day is closed.)
  return entry.dayOffset === 0 && phHour(now) < entry.cutoffHour
}

/** Every slot the customer can still book right now, in display order. */
export function availableSlots(now: Date = new Date()): Slot[] {
  return SLOT_TABLE.filter((entry) => isSlotAvailable(entry.id, now)).map((entry) =>
    buildSlot(entry, now),
  )
}

/**
 * Resolve a slot id to the (fulfillmentDate, fulfillmentPeriod) pair we will
 * store on the order. Returns null if the slot id is unknown or its window
 * has already closed — callers should refuse the order in that case.
 */
export function resolveSlot(
  id: SlotId,
  now: Date = new Date(),
): { fulfillmentDate: Date; fulfillmentPeriod: FulfillmentPeriod } | null {
  if (!isSlotAvailable(id, now)) return null
  const entry = SLOT_TABLE.find((e) => e.id === id)!
  const slot = buildSlot(entry, now)
  return { fulfillmentDate: slot.date, fulfillmentPeriod: slot.period }
}

// ---------------------------------------------------------------------------
// Display helpers (used by admin + confirmation pages)
// ---------------------------------------------------------------------------

/** "Today", "Tomorrow", "Yesterday", or "Sep 8, 2026" — read in PH time. */
export function describeServiceDay(
  fulfillmentDate: Date | string,
  now: Date = new Date(),
): string {
  const date = new Date(fulfillmentDate)
  const key = phDayKey(date)
  if (key === phDayKey(now)) return 'Today'
  if (key === phDayKey(phAddDays(now, 1))) return 'Tomorrow'
  if (key === phDayKey(phAddDays(now, -1))) return 'Yesterday'
  return formatDateShort(date)
}

/** "Tomorrow (Sep 8, 2026)" style, without repeating on a plain date. */
export function describeServiceDayLong(
  fulfillmentDate: Date | string,
  now: Date = new Date(),
): string {
  const date = new Date(fulfillmentDate)
  const relative = describeServiceDay(date, now)
  const absolute = formatDateShort(date)
  return relative === absolute ? absolute : `${relative} (${absolute})`
}

/** "Today – 4PM Snack" style, joining the day and period consistently. */
export function describeSlot(
  fulfillmentDate: Date | string,
  fulfillmentPeriod: FulfillmentPeriod,
  now: Date = new Date(),
): string {
  return `${describeServiceDay(fulfillmentDate, now)} – ${PERIOD_LABELS[fulfillmentPeriod]}`
}

/** True when the order's fulfillment day is after the day it was created. */
export function isAdvanceOrder(order: {
  fulfillmentDate: Date | string
  createdAt: Date | string
}): boolean {
  return phDayKey(new Date(order.fulfillmentDate)) !== phDayKey(new Date(order.createdAt))
}
