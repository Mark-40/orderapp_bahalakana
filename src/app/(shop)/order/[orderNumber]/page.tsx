import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarClock, CheckCircle2, Clock, ExternalLink, QrCode, Truck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrderStatusBadge } from '@/components/admin/order-status-badge'
import { OrderSummary } from '@/components/customer/order-summary'
import { prisma } from '@/lib/db'
import { BREAKFAST_CUTOFF_LABEL, describeServiceDay } from '@/lib/orders/schedule'
import { formatDateShort, formatDateTime } from '@/lib/utils'
import { ORDER_TYPE_LABELS, type OrderTypeValue } from '@/lib/validation/schemas'

// Status changes as the shop works the order, so never serve this from cache.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Order confirmed',
  // This page shows a customer's name and delivery address. Keep it out of
  // search indexes — the link is private to whoever placed the order.
  robots: { index: false, follow: false },
}

/**
 * Confirmation page, addressable by order number so the customer can bookmark
 * it or reopen the link later to check the current status.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params

  const order = await prisma.order.findUnique({
    where: { orderNumber: decodeURIComponent(orderNumber) },
    select: {
      orderNumber: true,
      customerName: true,
      notes: true,
      status: true,
      orderType: true,
      isAdvance: true,
      scheduledFor: true,
      paymentMethod: true,
      paymentReceiptUrl: true,
      subtotal: true,
      total: true,
      createdAt: true,
      items: {
        select: { productName: true, price: true, quantity: true, subtotal: true },
      },
    },
  })

  // Renders the shared not-found page. Note that Next 16 has already flushed
  // the response shell for a dynamically-rendered route by this point, so the
  // HTTP status stays 200 even though the not-found UI is what the visitor
  // sees. The page is noindex'd above, so nothing depends on the status code.
  if (!order) notFound()

  const firstName = order.customerName.split(' ')[0] ?? order.customerName

  return (
    <div className="min-h-dvh px-4 py-8">
      <main className="mx-auto max-w-lg space-y-5">
        <div className="text-center animate-[in-up_0.3s_cubic-bezier(0.22,1,0.36,1)]">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-leaf-100 text-leaf-600">
            <CheckCircle2 className="size-9" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-ink-900">Order Confirmed!</h1>
          <p className="mt-1.5 text-base text-ink-700">
            Thank you, <span className="font-bold">{firstName}</span>!
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Your order has been received. The shop will contact you shortly.
          </p>
        </div>

        {order.isAdvance && order.scheduledFor ? (
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3.5 text-sky-900">
            <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold">Advance order · {describeServiceDay(order.scheduledFor)}</p>
              <p className="mt-0.5 text-xs leading-relaxed">
                {order.orderType === 'BREAKFAST'
                  ? `Placed after ${BREAKFAST_CUTOFF_LABEL}, so it is booked for the ${formatDateShort(
                      order.scheduledFor,
                    )} breakfast service.`
                  : `Booked for ${formatDateShort(order.scheduledFor)}.`}
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Order number
              </p>
              <p className="tabular mt-0.5 text-lg font-extrabold text-ink-900">
                {order.orderNumber}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <dl className="mt-3 space-y-2 border-t border-cream-200 pt-3 text-sm">
            <div className="flex items-center gap-2 text-ink-500">
              <Clock className="size-4 shrink-0" aria-hidden />
              <dt className="sr-only">Placed at</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            <div className="flex items-center gap-2 text-ink-500">
              <Truck className="size-4 shrink-0" aria-hidden />
              <dt className="sr-only">Fulfilment</dt>
              <dd>For delivery</dd>
            </div>
            <div className="flex items-center gap-2 text-ink-500">
              <CalendarClock className="size-4 shrink-0" aria-hidden />
              <dt className="sr-only">Order type</dt>
              <dd>
                {ORDER_TYPE_LABELS[order.orderType as OrderTypeValue]}
                {order.scheduledFor ? ` · ${describeServiceDay(order.scheduledFor)}` : ''}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-ink-500">
              {order.paymentMethod === 'GCASH' ? (
                <QrCode className="size-4 shrink-0" aria-hidden />
              ) : (
                <Wallet className="size-4 shrink-0" aria-hidden />
              )}
              <dt className="sr-only">Payment</dt>
              <dd>
                {order.paymentMethod === 'GCASH' ? 'Paid via GCash' : 'Cash on delivery'}
                {order.paymentMethod === 'GCASH' && order.paymentReceiptUrl ? (
                  <>
                    {' · '}
                    <a
                      href={order.paymentReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-semibold text-brand-600 underline-offset-4 hover:underline"
                    >
                      View receipt
                      <ExternalLink className="size-3" />
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          </dl>

          {order.notes ? (
            <p className="mt-3 rounded-xl bg-cream-100 p-3 text-sm leading-relaxed text-ink-700">
              <span className="font-semibold">Your note: </span>
              {order.notes}
            </p>
          ) : null}
        </div>

        <OrderSummary
          lines={order.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          }))}
          subtotal={order.subtotal}
          total={order.total}
        />

        <div className="space-y-2">
          <Button asChild block size="lg">
            <Link href="/">Back to Menu</Link>
          </Button>
          <p className="text-center text-xs text-ink-300">
            Save this page — you can reopen it any time to check your order status.
          </p>
        </div>
      </main>
    </div>
  )
}
