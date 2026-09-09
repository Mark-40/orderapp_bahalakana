import { CalendarClock, Coffee, Sun } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  type FulfillmentPeriod,
  PERIOD_LABELS,
  describeServiceDay,
  isAdvanceOrder,
} from '@/lib/orders/schedule'

const PERIOD_ICON: Record<FulfillmentPeriod, typeof CalendarClock> = {
  BREAKFAST: Sun,
  SNACK: Coffee,
}

export type OrderScheduleFields = {
  fulfillmentDate: Date | string
  fulfillmentPeriod: FulfillmentPeriod
  createdAt: Date | string
}

/**
 * The service window an order is prepared for — day plus period — plus a
 * secondary "Advance" chip when the order was placed on an earlier day than
 * its fulfillment. Reading the primary badge alone tells the shop when to
 * cook; the Advance chip flags that this was booked ahead.
 */
export function OrderScheduleBadge({ order }: { order: OrderScheduleFields }) {
  const Icon = PERIOD_ICON[order.fulfillmentPeriod] ?? CalendarClock
  const advance = isAdvanceOrder(order)

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone="brand">
        <Icon className="size-3.5" />
        {describeServiceDay(order.fulfillmentDate)} · {PERIOD_LABELS[order.fulfillmentPeriod]}
      </Badge>
      {advance ? (
        <Badge tone="info">
          <CalendarClock className="size-3.5" />
          Advance
        </Badge>
      ) : null}
    </span>
  )
}
