import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  Store,
  User,
  Wallet,
} from 'lucide-react'
import { OrderStatusBadge } from '@/components/admin/order-status-badge'
import { StatusUpdater } from '@/components/admin/status-updater'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db'
import { formatMoney, formatMoneyCompact } from '@/lib/money'
import { formatDateTime, formatPhone } from '@/lib/utils'
import type { OrderStatusValue } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id }, select: { orderNumber: true } })
  return { title: order ? `Order ${order.orderNumber}` : 'Order' }
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { productName: 'asc' },
        // menuItem is nullable: the item may have been deleted from the menu.
        select: {
          id: true,
          productName: true,
          price: true,
          quantity: true,
          subtotal: true,
          menuItemId: true,
        },
      },
    },
  })

  if (!order) notFound()

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/orders"
          className="-ml-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="size-4" />
          All orders
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="tabular text-2xl font-extrabold text-ink-900">{order.orderNumber}</h1>
            <p className="mt-0.5 text-sm text-ink-500">{formatDateTime(order.createdAt)}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-cream-200">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0">
                    <span className="tabular mt-0.5 grid min-w-8 shrink-0 place-items-center rounded-md bg-cream-100 px-1.5 py-1 text-xs font-bold text-ink-700">
                      ×{item.quantity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-900">{item.productName}</p>
                      <p className="tabular mt-0.5 text-xs text-ink-500">
                        {formatMoney(item.price)} each
                        {item.menuItemId === null ? ' · no longer on the menu' : ''}
                      </p>
                    </div>
                    <p className="tabular text-sm font-bold text-ink-900">
                      {formatMoneyCompact(item.subtotal)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-3 space-y-1.5 border-t border-cream-200 pt-3">
                <div className="flex items-center justify-between text-sm text-ink-500">
                  <span>Subtotal</span>
                  <span className="tabular">{formatMoney(order.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-ink-900">Total</span>
                  <span className="tabular text-2xl font-extrabold text-ink-900">
                    {formatMoney(order.total)}
                  </span>
                </div>
              </div>

              <p className="mt-3 rounded-lg bg-cream-100 px-3 py-2 text-xs leading-relaxed text-ink-500">
                Prices shown are the ones captured when this order was placed. Later menu edits do
                not change them.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusUpdater orderId={order.id} currentStatus={order.status as OrderStatusValue} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={<User className="size-4" />} label="Name" value={order.customerName} />

              {order.customerPhone ? (
                <DetailRow
                  icon={<Phone className="size-4" />}
                  label="Phone"
                  value={
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="tabular font-semibold text-brand-600 underline-offset-4 hover:underline"
                    >
                      {formatPhone(order.customerPhone)}
                    </a>
                  }
                />
              ) : null}

              {order.customerEmail ? (
                <DetailRow
                  icon={<Mail className="size-4" />}
                  label="Email"
                  value={
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="break-all font-semibold text-brand-600 underline-offset-4 hover:underline"
                    >
                      {order.customerEmail}
                    </a>
                  }
                />
              ) : null}

              <DetailRow
                icon={
                  order.fulfillment === 'DELIVERY' ? (
                    <MapPin className="size-4" />
                  ) : (
                    <Store className="size-4" />
                  )
                }
                label="Fulfilment"
                value={
                  order.fulfillment === 'DELIVERY'
                    ? (order.deliveryAddress ?? 'For delivery')
                    : 'Pickup at the shop'
                }
              />

              <DetailRow
                icon={
                  order.paymentMethod === 'GCASH' ? (
                    <QrCode className="size-4" />
                  ) : (
                    <Wallet className="size-4" />
                  )
                }
                label="Payment"
                value={
                  <div className="space-y-1.5">
                    <p className="font-semibold">
                      {order.paymentMethod === 'GCASH' ? 'Paid via GCash' : 'Cash on delivery'}
                    </p>
                    {order.paymentMethod === 'GCASH' && order.paymentReceiptUrl ? (
                      <a
                        href={order.paymentReceiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-cream-200 bg-cream-50 p-1.5 pr-2.5 text-xs font-semibold text-brand-600 hover:bg-cream-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={order.paymentReceiptUrl}
                          alt="GCash receipt"
                          className="size-10 rounded-md object-cover"
                        />
                        View receipt
                        <ExternalLink className="size-3" />
                      </a>
                    ) : order.paymentMethod === 'GCASH' ? (
                      <p className="text-xs text-chili-600">Receipt missing.</p>
                    ) : null}
                  </div>
                }
              />

              {order.notes ? (
                <DetailRow
                  icon={<MessageSquare className="size-4" />}
                  label="Notes"
                  value={order.notes}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-500">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</p>
        <div className="mt-0.5 text-sm leading-relaxed break-words text-ink-900">{value}</div>
      </div>
    </div>
  )
}
