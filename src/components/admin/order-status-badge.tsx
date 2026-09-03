import { Badge } from '@/components/ui/badge'
import type { OrderStatusValue } from '@/lib/validation/schemas'

/** Single source of truth for how each status looks and reads. */
export const STATUS_META: Record<
  OrderStatusValue,
  { label: string; tone: 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'danger'; dot: string }
> = {
  PENDING: { label: 'Pending', tone: 'warning', dot: 'bg-amber-500' },
  CONFIRMED: { label: 'Confirmed', tone: 'info', dot: 'bg-sky-500' },
  PREPARING: { label: 'Preparing', tone: 'brand', dot: 'bg-brand-500' },
  READY: { label: 'Ready', tone: 'success', dot: 'bg-leaf-600' },
  COMPLETED: { label: 'Completed', tone: 'success', dot: 'bg-leaf-700' },
  CANCELLED: { label: 'Cancelled', tone: 'danger', dot: 'bg-chili-600' },
}

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as OrderStatusValue] ?? {
    label: status,
    tone: 'neutral' as const,
    dot: 'bg-ink-300',
  }

  return (
    <Badge tone={meta.tone}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </Badge>
  )
}
