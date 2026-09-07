'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarClock, Check, Coffee, QrCode, ShoppingBag, Sun, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { EmptyState, ErrorState } from '@/components/ui/states'
import {
  BREAKFAST_CUTOFF_LABEL,
  resolveOrderSchedule,
  rollsOverToTomorrow,
} from '@/lib/orders/schedule'
import { checkoutSchema } from '@/lib/validation/schemas'
import type { OrderTypeValue, PaymentMethodValue } from '@/lib/validation/schemas'
import { cn, formatDateShort } from '@/lib/utils'
import { submitOrderAction } from '@/server/actions/checkout'
import { useCart } from '@/store/cart'
import { GCashPaymentDialog } from './gcash-payment-dialog'
import { OrderSummary } from './order-summary'

type Errors = Record<string, string | undefined>

/**
 * Checkout.
 *
 * Every order is a delivery. The payload carries menu item ids, quantities and
 * the customer's name / address / payment choice. Prices go along only as
 * `shownPrices`, which the server uses to tell the customer what changed —
 * never to compute the total.
 */
export function CheckoutForm() {
  const router = useRouter()
  const { lines, ready, subtotal, setQuantity, removeMany, clear } = useCart()

  const [errors, setErrors] = React.useState<Errors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [orderType, setOrderType] = React.useState<OrderTypeValue>('ADVANCE')
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethodValue>('CASH')
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null)
  const [gcashOpen, setGcashOpen] = React.useState(false)

  // Read after mount only: the server and the browser can disagree about the
  // clock, and the cutoff notice has to reflect the real current time. Kept
  // fresh every minute so it flips at 4PM without a reload. The server decides
  // for real at submit time — this is only here so nothing is a surprise.
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => {
    const readClock = () => setNow(new Date())
    // Read once just after mount, then once a minute, so the notice appears
    // without a reload and flips the moment the cutoff passes.
    const first = setTimeout(readClock, 0)
    const timer = setInterval(readClock, 60_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  const rollsOver = now ? rollsOverToTomorrow(orderType, now) : false
  const serviceDate = (() => {
    if (!now) return ''
    const { scheduledFor } = resolveOrderSchedule(orderType, now)
    return scheduledFor ? formatDateShort(scheduledFor) : ''
  })()

  // One key per checkout attempt. It makes the submission idempotent, so a
  // double-tap or a retried request can never create two orders.
  const idempotencyKey = React.useRef<string>(newKey())
  // A submission that succeeded must not be replayed by the back button.
  const submitted = React.useRef(false)

  // Ready to submit: cash always ok, GCash needs an attached receipt.
  const paymentReady = paymentMethod === 'CASH' || (paymentMethod === 'GCASH' && !!receiptUrl)

  function selectPaymentMethod(method: PaymentMethodValue) {
    setPaymentMethod(method)
    if (method === 'GCASH') {
      setGcashOpen(true)
    } else {
      setReceiptUrl(null)
    }
    setErrors((prev) => ({ ...prev, paymentReceiptUrl: undefined }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || submitted.current) return

    // For GCash, force the customer through the QR/receipt flow before submit.
    if (paymentMethod === 'GCASH' && !receiptUrl) {
      setGcashOpen(true)
      return
    }

    setFormError(null)
    setErrors({})

    const formData = new FormData(event.currentTarget)
    const payload = {
      customerName: String(formData.get('customerName') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      orderType,
      paymentMethod,
      paymentReceiptUrl: receiptUrl ?? '',
      idempotencyKey: idempotencyKey.current,
      items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
    }

    // Client-side pass first, purely so mistakes surface without a round trip.
    const local = checkoutSchema.safeParse(payload)
    if (!local.success) {
      setErrors(firstErrors(local.error.flatten().fieldErrors))
      focusFirstInvalid(event.currentTarget)
      return
    }

    setSubmitting(true)
    try {
      const result = await submitOrderAction({
        ...payload,
        shownPrices: Object.fromEntries(lines.map((l) => [l.menuItemId, l.price])),
      })

      switch (result.status) {
        case 'success': {
          submitted.current = true
          clear()
          router.replace(`/order/${result.orderNumber}`)
          return
        }

        case 'invalid': {
          setErrors(firstErrors(result.fieldErrors))
          if (result.message) setFormError(result.message)
          focusFirstInvalid(event.currentTarget)
          break
        }

        case 'cart-issues': {
          // The cart drifted out of date: fix what we can and explain the rest.
          const removable = result.issues
            .filter((i) => i.type === 'UNAVAILABLE' || i.type === 'REMOVED')
            .map((i) => i.menuItemId)
          if (removable.length > 0) removeMany(removable)
          setFormError(result.messages.join(' '))
          result.messages.forEach((message) => toast.warning(message))
          // Retrying is a new attempt, so it needs a new key.
          idempotencyKey.current = newKey()
          break
        }

        case 'error': {
          setFormError(result.message)
          break
        }
      }
    } catch {
      setFormError(
        'We could not reach the shop. Please check your internet connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-cream-200" aria-busy="true" />
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-6" />}
        title="Your cart is empty"
        description="Pick a few items from the menu, then come back here to place your order."
        action={
          <Button asChild>
            <Link href="/">Back to Menu</Link>
          </Button>
        }
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-500 uppercase">Your order</h2>
        <OrderSummary
          lines={lines.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            price: l.price,
            subtotal: l.price * l.quantity,
          }))}
          subtotal={subtotal}
          total={subtotal}
          note="Prices are confirmed by the shop when your order is received."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {lines.map((line) => (
            <button
              key={line.menuItemId}
              type="button"
              onClick={() => setQuantity(line.menuItemId, line.quantity - 1)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-500 ring-1 ring-cream-200 transition-colors hover:text-chili-600"
            >
              Remove one {line.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold tracking-wide text-ink-500 uppercase">Your details</h2>

        <Field label="Name" htmlFor="customerName" required error={errors.customerName}>
          <Input
            id="customerName"
            name="customerName"
            autoComplete="name"
            enterKeyHint="next"
            placeholder="Juan Dela Cruz"
            invalid={Boolean(errors.customerName)}
            maxLength={80}
          />
        </Field>

        <Field
          label="Order notes"
          htmlFor="notes"
          error={errors.notes}
          hint="Allergies, no onions, delivery time — anything the shop should know."
        >
          <Textarea
            id="notes"
            name="notes"
            placeholder="If Advance Order - please specify, tinatamad na ako mag dev"
            invalid={Boolean(errors.notes)}
            maxLength={500}
            className="min-h-20"
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-ink-500 uppercase">Order type</h2>
        <div className="grid grid-cols-3 gap-2">
          <OrderTypeOption
            selected={orderType === 'ADVANCE'}
            onSelect={() => setOrderType('ADVANCE')}
            icon={<CalendarClock className="size-5" />}
            label="Advance Order"
          />
          <OrderTypeOption
            selected={orderType === 'SNACK_4PM'}
            onSelect={() => setOrderType('SNACK_4PM')}
            icon={<Coffee className="size-5" />}
            label="4PM Snack"
          />
          <OrderTypeOption
            selected={orderType === 'BREAKFAST'}
            onSelect={() => setOrderType('BREAKFAST')}
            icon={<Sun className="size-5" />}
            label="Morning Breakfast"
          />
        </div>

        {rollsOver ? (
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <CalendarClock className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">This becomes an advance order for tomorrow</p>
              <p className="mt-0.5 text-xs leading-relaxed">
                It is already past {BREAKFAST_CUTOFF_LABEL}, so today&rsquo;s breakfast service has
                closed. The shop will prepare this order tomorrow morning
                {serviceDate ? ` — ${serviceDate}` : ''}.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-ink-500 uppercase">
          Payment method
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <PaymentOption
            selected={paymentMethod === 'CASH'}
            onSelect={() => selectPaymentMethod('CASH')}
            icon={<Wallet className="size-5" />}
            label="Cash"
            caption="Pay on delivery"
          />
          <PaymentOption
            selected={paymentMethod === 'GCASH'}
            onSelect={() => selectPaymentMethod('GCASH')}
            icon={<QrCode className="size-5" />}
            label="GCash"
            caption="Scan QR to pay"
          />
        </div>

        {paymentMethod === 'GCASH' ? (
          <div
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-3 text-sm',
              receiptUrl
                ? 'border-leaf-100 bg-leaf-100/40 text-leaf-700'
                : 'border-brand-100 bg-brand-50 text-brand-700',
            )}
          >
            {receiptUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptUrl}
                  alt="GCash receipt"
                  className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-white"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-bold">
                    <Check className="size-4" />
                    Receipt attached
                  </p>
                  <button
                    type="button"
                    onClick={() => setGcashOpen(true)}
                    className="mt-0.5 text-xs font-semibold underline underline-offset-4"
                  >
                    View or replace
                  </button>
                </div>
              </>
            ) : (
              <>
                <QrCode className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Complete your GCash payment</p>
                  <button
                    type="button"
                    onClick={() => setGcashOpen(true)}
                    className="mt-0.5 text-xs font-semibold underline underline-offset-4"
                  >
                    Show QR & upload receipt
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {errors.paymentReceiptUrl ? (
          <p className="text-xs font-semibold text-chili-600">{errors.paymentReceiptUrl}</p>
        ) : null}
      </section>

      {formError ? <ErrorState title="We could not place your order" description={formError} /> : null}

      <div className="safe-bottom sticky bottom-0 -mx-4 border-t border-cream-200 bg-cream-100/95 px-4 pt-3 backdrop-blur-sm">
        <Button
          type="submit"
          block
          size="lg"
          loading={submitting}
          disabled={!paymentReady}
        >
          {submitting
            ? 'Placing your order'
            : paymentMethod === 'GCASH' && !receiptUrl
              ? 'Attach receipt to continue'
              : 'Submit Order'}
        </Button>
        <Button asChild variant="ghost" block size="sm" className="mt-1">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to Menu
          </Link>
        </Button>
      </div>

      <GCashPaymentDialog
        open={gcashOpen}
        onOpenChange={setGcashOpen}
        amount={subtotal}
        initialReceiptUrl={receiptUrl}
        onConfirm={(url) => setReceiptUrl(url)}
      />
    </form>
  )
}

function OrderTypeOption({
  selected,
  onSelect,
  icon,
  label,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-20 flex-col items-start justify-center gap-1 rounded-xl border px-3 py-3 text-left transition-colors',
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/25'
          : 'border-cream-200 bg-white text-ink-700 hover:bg-cream-50',
      )}
    >
      {icon}
      <span className="text-sm font-bold leading-tight">{label}</span>
    </button>
  )
}

function PaymentOption({
  selected,
  onSelect,
  icon,
  label,
  caption,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  label: string
  caption: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-20 flex-col items-start justify-center gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/25'
          : 'border-cream-200 bg-white text-ink-700 hover:bg-cream-50',
      )}
    >
      {icon}
      <span className="mt-1 text-sm font-bold">{label}</span>
      <span className={cn('text-xs', selected ? 'text-brand-600' : 'text-ink-500')}>{caption}</span>
    </button>
  )
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function firstErrors(fieldErrors: Record<string, string[] | undefined>): Errors {
  const result: Errors = {}
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) result[field] = messages[0]
  }
  return result
}

function focusFirstInvalid(form: HTMLFormElement) {
  // Defer so React has painted the aria-invalid attributes first.
  requestAnimationFrame(() => {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}
