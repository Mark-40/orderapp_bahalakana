'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { ORDER_STATUSES, type OrderStatusValue } from '@/lib/validation/schemas'
import { updateOrderStatusAction } from '@/server/actions/orders'
import { STATUS_META } from './order-status-badge'

/**
 * Status control for a single order. The most common next step also gets a
 * one-tap button, since on a busy morning the owner mostly just advances the
 * order one stage at a time.
 */
const NEXT_STEP: Partial<Record<OrderStatusValue, OrderStatusValue>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
}

export function StatusUpdater({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: OrderStatusValue
}) {
  const router = useRouter()
  const [selected, setSelected] = React.useState<OrderStatusValue>(currentStatus)
  const [pending, setPending] = React.useState(false)

  // Re-sync when the page re-renders with a newer status from the server.
  // Adjusting during render (rather than in an effect) avoids a flash of the
  // stale selection.
  const [renderedStatus, setRenderedStatus] = React.useState(currentStatus)
  if (renderedStatus !== currentStatus) {
    setRenderedStatus(currentStatus)
    setSelected(currentStatus)
  }

  async function save(status: OrderStatusValue) {
    if (pending || status === currentStatus) return
    setPending(true)
    try {
      const result = await updateOrderStatusAction(orderId, status)
      if (result.ok) {
        toast.success(result.message ?? 'Status updated.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Could not update the status.')
        setSelected(currentStatus)
      }
    } catch {
      toast.error('Could not reach the server. Please try again.')
      setSelected(currentStatus)
    } finally {
      setPending(false)
    }
  }

  const next = NEXT_STEP[currentStatus]

  return (
    <div className="space-y-3">
      {next ? (
        <Button block size="lg" loading={pending} onClick={() => save(next)}>
          Mark as {STATUS_META[next].label}
        </Button>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={selected}
          aria-label="Order status"
          disabled={pending}
          onChange={(event) => setSelected(event.target.value as OrderStatusValue)}
          className="flex-1"
        >
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_META[status].label}
            </option>
          ))}
        </Select>

        <Button
          variant="outline"
          loading={pending}
          disabled={selected === currentStatus}
          onClick={() => save(selected)}
          className="sm:w-40"
        >
          Update Status
        </Button>
      </div>
    </div>
  )
}
