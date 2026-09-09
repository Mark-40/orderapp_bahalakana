import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Receipt } from 'lucide-react'
import { DataTable, type Column } from '@/components/admin/data-table'
import { OrderFilters } from '@/components/admin/order-filters'
import { OrderScheduleBadge } from '@/components/admin/order-schedule-badge'
import { OrderStatusBadge } from '@/components/admin/order-status-badge'
import { OrderViewTabs } from '@/components/admin/order-view-tabs'
import { Pagination } from '@/components/admin/pagination'
import { EmptyState } from '@/components/ui/states'
import { prisma } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'
import { endOfDay, startOfDay } from '@/lib/dashboard/date-range'
import { formatMoneyCompact } from '@/lib/money'
import { type FulfillmentPeriod, phAddDays, phStartOfDay } from '@/lib/orders/schedule'
import { formatDateTime, formatPhone } from '@/lib/utils'
import { orderFilterSchema } from '@/lib/validation/schemas'

export const metadata: Metadata = { title: 'Orders' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

type OrderRow = {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string | null
  createdAt: Date
  itemCount: number
  total: number
  status: string
  fulfillmentDate: Date
  fulfillmentPeriod: FulfillmentPeriod
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  // Interpret the YYYY-MM-DD as a PH-calendar date. Anchor at PH noon so
  // rounding to PH midnight lands on the intended day.
  const noonPh = new Date(Date.UTC(y, m - 1, d, 12) - 8 * 60 * 60 * 1000)
  return Number.isNaN(noonPh.getTime()) ? null : noonPh
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const parsed = orderFilterSchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    from: typeof raw.from === 'string' ? raw.from : undefined,
    to: typeof raw.to === 'string' ? raw.to : undefined,
    fdate: typeof raw.fdate === 'string' ? raw.fdate : undefined,
    period: typeof raw.period === 'string' ? raw.period : undefined,
    view: typeof raw.view === 'string' ? raw.view : undefined,
    page: typeof raw.page === 'string' ? raw.page : 1,
  })

  // A malformed query string should show an unfiltered list, not an error page.
  const filters = parsed.success
    ? parsed.data
    : {
        q: undefined,
        status: undefined,
        from: undefined,
        to: undefined,
        fdate: undefined,
        period: undefined,
        view: 'all' as const,
        page: 1,
      }

  const now = new Date()
  const advanceView = filters.view === 'advance'

  // Resolve the fulfillment-date filter. Presets (today/tomorrow) short-circuit
  // the custom from/to. Otherwise from/to are read as PH-calendar dates.
  const fdateBounds: { gte?: Date; lte?: Date } | null = (() => {
    if (filters.fdate === 'today') {
      const start = phStartOfDay(now)
      return { gte: start, lte: new Date(phAddDays(start, 1).getTime() - 1) }
    }
    if (filters.fdate === 'tomorrow') {
      const start = phAddDays(phStartOfDay(now), 1)
      return { gte: start, lte: new Date(phAddDays(start, 1).getTime() - 1) }
    }
    const from = parseDate(filters.from)
    const to = parseDate(filters.to)
    if (!from && !to) return null
    return {
      ...(from ? { gte: startOfDay(from) } : {}),
      ...(to ? { lte: endOfDay(to) } : {}),
    }
  })()

  // Everything except the tab. Tab counts are computed against this, so each
  // tab shows how many orders match the *current* search and filters.
  const baseWhere: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.period ? { fulfillmentPeriod: filters.period } : {}),
    ...(fdateBounds ? { fulfillmentDate: fdateBounds } : {}),
    ...(filters.q
      ? {
          OR: [
            { orderNumber: { contains: filters.q, mode: 'insensitive' } },
            { customerName: { contains: filters.q, mode: 'insensitive' } },
            { customerPhone: { contains: filters.q.replace(/\D/g, '') || filters.q } },
          ],
        }
      : {}),
  }

  // "Advance" = fulfillment day strictly after the day the order was placed.
  // Prisma cannot express column-vs-column comparisons directly, so this is
  // approximated as "fulfillmentDate >= tomorrow's PH midnight". Correct in
  // every case except an order placed and fulfilled on the same day (which is
  // never advance anyway).
  const tomorrow = phAddDays(phStartOfDay(now), 1)
  const where: Prisma.OrderWhereInput = advanceView
    ? { ...baseWhere, fulfillmentDate: { ...(fdateBounds ?? {}), gte: tomorrow } }
    : baseWhere

  const [allCount, advanceCount] = await Promise.all([
    prisma.order.count({ where: baseWhere }),
    prisma.order.count({
      where: {
        ...baseWhere,
        fulfillmentDate: { ...(fdateBounds ?? {}), gte: tomorrow },
      },
    }),
  ])

  const total = advanceView ? advanceCount : allCount
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)

  const orders = await prisma.order.findMany({
    where,
    // Advance view sorts by soonest fulfillment day first; regular view by
    // newest-placed first.
    orderBy: advanceView
      ? [{ fulfillmentDate: 'asc' }, { fulfillmentPeriod: 'asc' }, { createdAt: 'asc' }]
      : { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      createdAt: true,
      itemCount: true,
      total: true,
      status: true,
      fulfillmentDate: true,
      fulfillmentPeriod: true,
    },
  })

  const columns: Column<OrderRow>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (row) => <span className="tabular font-bold text-ink-900">{row.orderNumber}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <div>
          <p className="font-semibold text-ink-900">{row.customerName}</p>
          <p className="tabular text-xs text-ink-500">
            {row.customerPhone ? formatPhone(row.customerPhone) : '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Fulfillment',
      cell: (row) => <OrderScheduleBadge order={row} />,
    },
    {
      key: 'date',
      header: 'Placed',
      hideBelow: 'lg',
      cell: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      hideBelow: 'lg',
      cell: (row) => <span className="tabular">{row.itemCount}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-right',
      cell: (row) => <span className="tabular font-bold">{formatMoneyCompact(row.total)}</span>,
    },
    { key: 'status', header: 'Status', cell: (row) => <OrderStatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <Link
          href={`/admin/orders/${row.id}`}
          className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline"
        >
          View
        </Link>
      ),
    },
  ]

  const filtered = Boolean(
    filters.q || filters.status || filters.period || filters.fdate || filters.from || filters.to,
  )

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-ink-900">
          {advanceView ? 'Advance orders' : 'Orders'}
        </h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {total} {advanceView ? 'advance ' : ''}order{total === 1 ? '' : 's'}
          {filtered ? ' matching your filters' : ' in total'}
          {advanceView ? ' · soonest fulfillment first' : ''}
        </p>
      </header>

      <OrderViewTabs
        active={filters.view}
        query={{
          q: filters.q,
          status: filters.status,
          from: filters.from,
          to: filters.to,
          fdate: filters.fdate,
          period: filters.period,
        }}
        counts={{ all: allCount, advance: advanceCount }}
      />

      <OrderFilters
        q={filters.q ?? ''}
        status={filters.status ?? ''}
        fdate={filters.fdate ?? ''}
        period={filters.period ?? ''}
        from={filters.from ?? ''}
        to={filters.to ?? ''}
        view={filters.view}
      />

      <DataTable
        rows={orders}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Orders"
        empty={
          <EmptyState
            icon={<Receipt className="size-6" />}
            title={
              filtered
                ? 'No orders match those filters'
                : advanceView
                  ? 'No advance orders'
                  : 'No orders yet'
            }
            description={
              filtered
                ? 'Try clearing the search or widening the date range.'
                : advanceView
                  ? 'Orders booked for a future day will show up here as soon as they come in.'
                  : 'Orders placed by customers will show up here right away.'
            }
          />
        }
        renderCard={(row) => (
          <Link
            href={`/admin/orders/${row.id}`}
            className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-soft)] transition-colors active:bg-cream-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="tabular text-sm font-bold text-ink-900">{row.orderNumber}</p>
                <OrderStatusBadge status={row.status} />
              </div>
              <p className="mt-1 truncate text-sm text-ink-700">{row.customerName}</p>
              <p className="tabular mt-0.5 text-xs text-ink-500">
                {row.itemCount} item{row.itemCount === 1 ? '' : 's'} · placed{' '}
                {formatDateTime(row.createdAt)}
              </p>
              <div className="mt-1.5">
                <OrderScheduleBadge order={row} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="tabular text-base font-extrabold text-ink-900">
                {formatMoneyCompact(row.total)}
              </p>
              <ArrowRight className="ml-auto mt-1 size-4 text-ink-300" />
            </div>
          </Link>
        )}
      />

      <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} />
    </div>
  )
}
