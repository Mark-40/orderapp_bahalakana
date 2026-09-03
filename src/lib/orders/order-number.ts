import 'server-only'
import type { Prisma } from '@/generated/prisma/client'

/**
 * Builds order numbers of the form ORD-YYYYMMDD-001.
 *
 * The per-day counter lives in its own table and is bumped with a single
 * atomic upsert inside the order transaction, so two simultaneous checkouts
 * can never be handed the same number. (`orderNumber` also carries a unique
 * index as a last line of defence.)
 */
export async function nextOrderNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const day = formatDayKey(now)

  const counter = await tx.orderCounter.upsert({
    where: { day },
    create: { day, last: 1 },
    update: { last: { increment: 1 } },
    select: { last: true },
  })

  return `ORD-${day}-${String(counter.last).padStart(3, '0')}`
}

/** Local-time YYYYMMDD — order numbers should match the shop's calendar day. */
export function formatDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}
