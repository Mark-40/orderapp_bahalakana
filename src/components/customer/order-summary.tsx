import { formatMoneyCompact } from '@/lib/money'

export type SummaryLine = { name: string; quantity: number; price: number; subtotal: number }

/**
 * Read-only totals block, shared by the checkout page and the confirmation
 * page so the customer sees the same breakdown before and after ordering.
 */
export function OrderSummary({
  lines,
  subtotal,
  total,
  note,
}: {
  lines: SummaryLine[]
  subtotal: number
  total: number
  note?: string
}) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-[var(--shadow-soft)]">
      <ul className="divide-y divide-cream-200">
        {lines.map((line, index) => (
          <li key={`${line.name}-${index}`} className="flex items-start gap-3 py-2.5 first:pt-0">
            <span className="tabular mt-0.5 grid min-w-7 shrink-0 place-items-center rounded-md bg-cream-100 px-1.5 py-0.5 text-xs font-bold text-ink-700">
              ×{line.quantity}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-tight font-semibold text-ink-900">{line.name}</p>
              <p className="tabular mt-0.5 text-xs text-ink-500">
                {formatMoneyCompact(line.price)} each
              </p>
            </div>
            <p className="tabular text-sm font-bold text-ink-900">
              {formatMoneyCompact(line.subtotal)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1.5 border-t border-cream-200 pt-3">
        <div className="flex items-center justify-between text-sm text-ink-500">
          <span>Subtotal</span>
          <span className="tabular">{formatMoneyCompact(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-ink-900">Total</span>
          <span className="tabular text-2xl font-extrabold text-ink-900">
            {formatMoneyCompact(total)}
          </span>
        </div>
      </div>

      {note ? <p className="mt-2 text-xs leading-relaxed text-ink-300">{note}</p> : null}
    </div>
  )
}
