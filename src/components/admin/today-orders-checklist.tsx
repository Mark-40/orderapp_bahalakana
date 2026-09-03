'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  MessageSquare,
  QrCode,
  Receipt,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/states'
import { formatMoney, formatMoneyCompact } from '@/lib/money'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'
import { updateOrderStatusAction } from '@/server/actions/orders'

export type ChecklistOrderItem = {
  id: string
  productName: string
  quantity: number
  price: number
  subtotal: number
}

export type ChecklistOrder = {
  id: string
  orderNumber: string
  customerName: string
  createdAt: Date
  itemCount: number
  total: number
  status: string
  notes: string | null
  paymentMethod: 'CASH' | 'GCASH'
  paymentReceiptUrl: string | null
  items: ChecklistOrderItem[]
}

/**
 * A checklist rendering of today's orders. Every order shows its line items
 * inline, so the admin can prep without clicking through to a detail page.
 * Ticking a row marks the order COMPLETED via `updateOrderStatusAction`;
 * unticking reverts it to PENDING so an accidental tick is easy to undo.
 * Optimistic UI — the row toggles immediately and rolls back if the server
 * rejects the change.
 */
export function TodayOrdersChecklist({ orders }: { orders: ChecklistOrder[] }) {
  const router = useRouter()
  const [done, setDone] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(orders.map((order) => [order.id, order.status === 'COMPLETED'])),
  )
  const [pending, setPending] = React.useState<Record<string, boolean>>({})

  // Re-sync when the server sends a fresh list (e.g. after router.refresh).
  const orderIdsKey = orders.map((o) => `${o.id}:${o.status}`).join('|')
  React.useEffect(() => {
    setDone(Object.fromEntries(orders.map((order) => [order.id, order.status === 'COMPLETED'])))
    // The join above is the intentional dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdsKey])

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="size-6" />}
        title="No orders in this period"
        description="New orders will appear here as soon as customers place them."
      />
    )
  }

  async function toggle(order: ChecklistOrder) {
    if (pending[order.id]) return
    const wasDone = done[order.id] ?? false
    const nextStatus = wasDone ? 'PENDING' : 'COMPLETED'

    setDone((state) => ({ ...state, [order.id]: !wasDone }))
    setPending((state) => ({ ...state, [order.id]: true }))

    try {
      const result = await updateOrderStatusAction(order.id, nextStatus)
      if (result.ok) {
        toast.success(
          nextStatus === 'COMPLETED'
            ? `${order.orderNumber} marked as done.`
            : `${order.orderNumber} moved back to pending.`,
        )
        router.refresh()
      } else {
        setDone((state) => ({ ...state, [order.id]: wasDone }))
        toast.error(result.error ?? 'Could not update the order.')
      }
    } catch {
      setDone((state) => ({ ...state, [order.id]: wasDone }))
      toast.error('Could not reach the server. Please try again.')
    } finally {
      setPending((state) => ({ ...state, [order.id]: false }))
    }
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        const checked = done[order.id] ?? false
        const isPending = pending[order.id] ?? false
        return (
          <li
            key={order.id}
            className={cn(
              'group rounded-2xl border border-cream-200 bg-white shadow-[var(--shadow-soft)] transition-colors',
              checked && 'bg-leaf-100/25 border-leaf-100',
            )}
          >
            <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={
                  checked
                    ? `Mark ${order.orderNumber} as pending`
                    : `Mark ${order.orderNumber} as done`
                }
                disabled={isPending}
                onClick={() => toggle(order)}
                className={cn(
                  'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ring-1 transition-all active:scale-95',
                  checked
                    ? 'bg-leaf-600 text-white ring-leaf-600 shadow-sm'
                    : 'bg-white text-transparent ring-cream-200 hover:ring-brand-400 hover:text-brand-400',
                  isPending && 'opacity-60',
                )}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin text-ink-500" />
                ) : (
                  <Check className={cn('size-5', !checked && 'opacity-0 group-hover:opacity-100')} />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p
                        className={cn(
                          'tabular text-sm font-bold',
                          checked ? 'text-ink-500 line-through' : 'text-ink-900',
                        )}
                      >
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-ink-500">{formatTime(order.createdAt)}</p>
                    </div>
                    <p
                      className={cn(
                        'truncate text-sm',
                        checked ? 'text-ink-300 line-through' : 'text-ink-700',
                      )}
                    >
                      {order.customerName}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <p
                      className={cn(
                        'tabular text-base font-extrabold',
                        checked ? 'text-ink-500 line-through' : 'text-ink-900',
                      )}
                    >
                      {formatMoneyCompact(order.total)}
                    </p>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      aria-label={`Open ${order.orderNumber}`}
                      className="grid size-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-cream-100 hover:text-ink-700"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>

                <ul className="mt-2 space-y-1 rounded-xl bg-cream-50 px-3 py-2 ring-1 ring-cream-100">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        'flex items-baseline gap-2 text-sm',
                        checked && 'text-ink-500 line-through',
                      )}
                    >
                      <span className="tabular grid min-w-7 shrink-0 place-items-center rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-ink-700 ring-1 ring-cream-200">
                        ×{item.quantity}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate font-semibold',
                          checked ? 'text-ink-500' : 'text-ink-900',
                        )}
                      >
                        {item.productName}
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-500">
                        {formatMoney(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    {order.paymentMethod === 'GCASH' ? (
                      <QrCode className="size-3.5" />
                    ) : (
                      <Wallet className="size-3.5" />
                    )}
                    {order.paymentMethod === 'GCASH' ? 'GCash' : 'Cash'}
                  </span>
                  {order.paymentMethod === 'GCASH' && order.paymentReceiptUrl ? (
                    <a
                      href={order.paymentReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-brand-600 underline-offset-4 hover:underline"
                    >
                      Receipt
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                  {order.notes ? (
                    <span className="inline-flex items-start gap-1">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2-safe">{order.notes}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
