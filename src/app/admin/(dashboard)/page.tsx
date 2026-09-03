import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ClipboardList,
  Clock,
  Flame,
  PhilippinePeso,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import { RangeFilter } from '@/components/admin/range-filter'
import { StatCard } from '@/components/admin/stat-card'
import { TodayOrdersChecklist } from '@/components/admin/today-orders-checklist'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db'
import { REVENUE_STATUSES, getBestSellers, getDailySales, getDashboardStats } from '@/lib/dashboard/stats'
import { resolveRange, toDateInputValue } from '@/lib/dashboard/date-range'
import { formatMoney, formatMoneyCompact } from '@/lib/money'
import { formatDateShort } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const range = resolveRange(params.range, params.from, params.to)

  const [stats, bestSellers, dailySales, recentOrders, openOrders] = await Promise.all([
    getDashboardStats(range),
    getBestSellers(range, 5),
    getDailySales(range),
    prisma.order.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        createdAt: true,
        itemCount: true,
        total: true,
        status: true,
        notes: true,
        paymentMethod: true,
        paymentReceiptUrl: true,
        items: {
          orderBy: { productName: 'asc' },
          select: { id: true, productName: true, quantity: true, price: true, subtotal: true },
        },
      },
    }),
    prisma.order.count({ where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } } }),
  ])

  const peakDay = dailySales.reduce<{ day: string; sales: number } | null>(
    (best, current) => (!best || current.sales > best.sales ? current : best),
    null,
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">{range.label}&rsquo;s Overview</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {range.key === 'today' || range.key === 'yesterday'
              ? formatDateShort(range.from)
              : `${formatDateShort(range.from)} — ${formatDateShort(range.to)}`}
          </p>
        </div>
        {openOrders > 0 ? (
          <Link href="/admin/orders?status=PENDING">
            <Badge tone="warning" className="min-h-9 px-3.5">
              <Clock className="size-3.5" />
              {openOrders} order{openOrders === 1 ? '' : 's'} still open
            </Badge>
          </Link>
        ) : null}
      </header>

      <RangeFilter
        activeKey={range.key}
        from={toDateInputValue(range.from)}
        to={toDateInputValue(range.to)}
      />

      <section aria-label="Key statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Orders"
          value={stats.totalOrders}
          hint={`${stats.itemsSold} item${stats.itemsSold === 1 ? '' : 's'} sold`}
          icon={<Receipt className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Total Sales"
          value={formatMoneyCompact(stats.totalSales)}
          hint={`${formatMoneyCompact(stats.completedSales)} completed`}
          icon={<PhilippinePeso className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Pending Orders"
          value={stats.pendingOrders}
          hint={`${stats.activeOrders} in progress`}
          icon={<Clock className="size-4" />}
          tone="warning"
        />
        <StatCard
          label="Completed"
          value={stats.completedOrders}
          hint={stats.cancelledOrders > 0 ? `${stats.cancelledOrders} cancelled` : 'None cancelled'}
          icon={<ClipboardList className="size-4" />}
          tone="brand"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-ink-500" />
              Sales summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow label="Average order value" value={formatMoney(stats.averageOrderValue)} />
            <SummaryRow label="Items sold" value={String(stats.itemsSold)} />
            <SummaryRow
              label="Busiest day"
              value={peakDay ? `${formatDateShort(peakDay.day)} · ${formatMoneyCompact(peakDay.sales)}` : '—'}
            />
            <SummaryRow label="Cancelled orders" value={String(stats.cancelledOrders)} />
            <p className="border-t border-cream-200 pt-3 text-xs leading-relaxed text-ink-300">
              Sales include every order except cancelled ones (
              {REVENUE_STATUSES.length} statuses).
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-4 text-brand-500" />
              Best sellers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestSellers.length === 0 ? (
              <p className="py-4 text-sm text-ink-500">No sales in this period yet.</p>
            ) : (
              <ol className="space-y-2.5">
                {bestSellers.map((item, index) => (
                  <li key={item.productName} className="flex items-center gap-3">
                    <span className="tabular grid size-7 shrink-0 place-items-center rounded-lg bg-cream-100 text-xs font-bold text-ink-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
                      {item.productName}
                    </span>
                    <span className="tabular shrink-0 text-sm text-ink-500">
                      {item.quantity} sold
                    </span>
                    <span className="tabular w-20 shrink-0 text-right text-sm font-bold text-ink-900">
                      {formatMoneyCompact(item.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-ink-900">{range.label}&rsquo;s orders</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Tick an order to mark it done.
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="flex items-center gap-1 text-sm font-semibold text-brand-600 underline-offset-4 hover:underline"
          >
            View all
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <TodayOrdersChecklist orders={recentOrders} />
      </section>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="tabular text-sm font-bold text-ink-900">{value}</span>
    </div>
  )
}
