import 'server-only'
import { prisma } from '@/lib/db'
import type { DateRange } from './date-range'

/**
 * All dashboard numbers are computed in the database, never in the browser.
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
  const createdAt = { gte: range.from, lte: range.to }

  const [byStatus, revenue, completed, items] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { createdAt, status: { in: [...REVENUE_STATUSES] } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { createdAt, status: 'COMPLETED' },
      _sum: { total: true },
    }),
    prisma.orderItem.aggregate({
      where: { order: { createdAt, status: { in: [...REVENUE_STATUSES] } } },
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
      order: { createdAt: { gte: range.from, lte: range.to }, status: { in: [...REVENUE_STATUSES] } },
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

/** Per-day totals for the sales summary, ordered oldest first. */
export async function getDailySales(
  range: DateRange,
): Promise<{ day: string; orders: number; sales: number }[]> {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: range.from, lte: range.to }, status: { in: [...REVENUE_STATUSES] } },
    select: { createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  })

  const buckets = new Map<string, { orders: number; sales: number }>()
  for (const order of orders) {
    const day = order.createdAt.toISOString().slice(0, 10)
    const bucket = buckets.get(day) ?? { orders: 0, sales: 0 }
    bucket.orders += 1
    bucket.sales += order.total
    buckets.set(day, bucket)
  }

  return [...buckets.entries()].map(([day, value]) => ({ day, ...value }))
}
