import 'server-only'
import { prisma } from '@/lib/db'
import { phDayKey } from '@/lib/orders/schedule'
import type { DateRange } from './date-range'

/**
 * All dashboard numbers are computed in the database, never in the browser.
 *
 * Statistics are keyed off `fulfillmentDate`, not `createdAt`, so a snack
 * ordered yesterday for today's 4PM service counts toward today's operational
 * workload, and a breakfast ordered today for tomorrow does not. `createdAt`
 * is preserved on every order for auditing but never drives these figures.
 *
 * Revenue rule: a cancelled order contributes nothing. Every other status
 * counts, because the shop has committed to the sale once it is accepted —
 * `completedSales` is reported alongside for owners who prefer cash-in-hand.
 */

export const REVENUE_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COMPLETED',
] as const

export type DashboardStats = {
  totalOrders: number
  totalSales: number
  completedSales: number
  averageOrderValue: number
  pendingOrders: number
  activeOrders: number
  completedOrders: number
  cancelledOrders: number
  itemsSold: number
}

export async function getDashboardStats(range: DateRange): Promise<DashboardStats> {
  const fulfillmentDate = { gte: range.from, lte: range.to }

  const [byStatus, revenue, completed, items] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: { fulfillmentDate },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { fulfillmentDate, status: { in: [...REVENUE_STATUSES] } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { fulfillmentDate, status: 'COMPLETED' },
      _sum: { total: true },
    }),
    prisma.orderItem.aggregate({
      where: { order: { fulfillmentDate, status: { in: [...REVENUE_STATUSES] } } },
      _sum: { quantity: true },
    }),
  ])

  const countOf = (status: string) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0

  const totalOrders = byStatus.reduce((sum, row) => sum + row._count._all, 0)
  const totalSales = revenue._sum.total ?? 0
  const revenueOrders = revenue._count._all

  return {
    totalOrders,
    totalSales,
    completedSales: completed._sum.total ?? 0,
    averageOrderValue: revenueOrders > 0 ? Math.round(totalSales / revenueOrders) : 0,
    pendingOrders: countOf('PENDING'),
    activeOrders: countOf('CONFIRMED') + countOf('PREPARING') + countOf('READY'),
    completedOrders: countOf('COMPLETED'),
    cancelledOrders: countOf('CANCELLED'),
    itemsSold: items._sum.quantity ?? 0,
  }
}

export type BestSeller = {
  menuItemId: string | null
  productName: string
  quantity: number
  revenue: number
}

export async function getBestSellers(range: DateRange, take = 5): Promise<BestSeller[]> {
  // Grouped by the frozen product name so items deleted from the menu still
  // show up in historical reporting.
  const rows = await prisma.orderItem.groupBy({
    by: ['productName'],
    where: {
      order: {
        fulfillmentDate: { gte: range.from, lte: range.to },
        status: { in: [...REVENUE_STATUSES] },
      },
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take,
  })

  return rows.map((row) => ({
    menuItemId: null,
    productName: row.productName,
    quantity: row._sum.quantity ?? 0,
    revenue: row._sum.subtotal ?? 0,
  }))
}

/** Per-day totals for the sales summary, ordered oldest first. Bucketed by the
 * PH day the orders are FULFILLED on, matching the rest of the dashboard. */
export async function getDailySales(
  range: DateRange,
): Promise<{ day: string; orders: number; sales: number }[]> {
  const orders = await prisma.order.findMany({
    where: {
      fulfillmentDate: { gte: range.from, lte: range.to },
      status: { in: [...REVENUE_STATUSES] },
    },
    select: { fulfillmentDate: true, total: true },
    orderBy: { fulfillmentDate: 'asc' },
  })

  const buckets = new Map<string, { orders: number; sales: number }>()
  for (const order of orders) {
    const day = phDayKey(order.fulfillmentDate)
    const bucket = buckets.get(day) ?? { orders: 0, sales: 0 }
    bucket.orders += 1
    bucket.sales += order.total
    buckets.set(day, bucket)
  }

  return [...buckets.entries()].map(([day, value]) => ({ day, ...value }))
}
