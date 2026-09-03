import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Receipt } from 'lucide-react'
import { DataTable, type Column } from '@/components/admin/data-table'
import { OrderFilters } from '@/components/admin/order-filters'
import { OrderStatusBadge } from '@/components/admin/order-status-badge'
import { Pagination } from '@/components/admin/pagination'
import { EmptyState } from '@/components/ui/states'
import { prisma } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'
import { endOfDay, startOfDay } from '@/lib/dashboard/date-range'
import { formatMoneyCompact } from '@/lib/money'
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
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
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
    page: typeof raw.page === 'string' ? raw.page : 1,
  })

  // A malformed query string should show an unfiltered list, not an error page.
  const filters = parsed.success ? parsed.data : { q: undefined, status: undefined, from: undefined, to: undefined, page: 1 }

  const from = parseDate(filters.from)
  const to = parseDate(filters.to)

  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: startOfDay(from) } : {}),
            ...(to ? { lte: endOfDay(to) } : {}),
          },
        }
      : {}),
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

  const total = await prisma.order.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Clamp so a stale ?page=99 link still renders a real page of results.
  const page = Math.min(filters.page, pageCount)

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
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
      key: 'date',
      header: 'Date / time',
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

  const filtered = Boolean(filters.q || filters.status || filters.from || filters.to)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-ink-900">Orders</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {total} order{total === 1 ? '' : 's'}
          {filtered ? ' matching your filters' : ' in total'}
        </p>
      </header>

      <OrderFilters
        q={filters.q ?? ''}
        status={filters.status ?? ''}
        from={filters.from ?? ''}
        to={filters.to ?? ''}
      />

      <DataTable
        rows={orders}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Orders"
        empty={
          <EmptyState
            icon={<Receipt className="size-6" />}
            title={filtered ? 'No orders match those filters' : 'No orders yet'}
            description={
              filtered
                ? 'Try clearing the search or widening the date range.'
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
                {row.itemCount} item{row.itemCount === 1 ? '' : 's'} · {formatDateTime(row.createdAt)}
              </p>
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
