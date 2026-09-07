import { CalendarClock, Coffee, Sun } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { describeServiceDay } from '@/lib/orders/schedule'
import { ORDER_TYPE_LABELS, type OrderTypeValue } from '@/lib/validation/schemas'

const TYPE_ICON: Record<OrderTypeValue, typeof CalendarClock> = {
  ADVANCE: CalendarClock,
  SNACK_4PM: Coffee,
  BREAKFAST: Sun,
}

export type OrderScheduleFields = {
  orderType: OrderTypeValue | string
  isAdvance: boolean
  scheduledFor: Date | string | null
}

/**
 * The order's service window, plus — for an advance order — the day it is
 * actually for. A breakfast ordered after the 4PM cutoff shows as
 * "Morning Breakfast" alongside "Advance · Tomorrow", so the shop can see at a
 * glance that it is not part of today's prep.
 */
export function OrderScheduleBadge({ order }: { order: OrderScheduleFields }) {
  const type = order.orderType as OrderTypeValue
  const Icon = TYPE_ICON[type] ?? CalendarClock

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone="brand">
        <Icon className="size-3.5" />
        {ORDER_TYPE_LABELS[type] ?? order.orderType}
      </Badge>
      {order.isAdvance ? (
        <Badge tone="info">
          <CalendarClock className="size-3.5" />
          Advance · {describeServiceDay(order.scheduledFor)}
        </Badge>
      ) : null}
    </span>
  )
}
