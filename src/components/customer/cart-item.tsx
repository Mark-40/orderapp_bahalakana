'use client'

import { Minus, Plus, Trash2 } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'
import { formatMoneyCompact } from '@/lib/money'
import type { CartLine } from '@/store/cart'

export function CartItem({
  line,
  onChangeQuantity,
  onRemove,
}: {
  line: CartLine
  onChangeQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  return (
    <li className="flex gap-3 py-3">
      <SmartImage
        src={line.imageUrl}
        alt={line.name}
        className="size-16 shrink-0 rounded-xl"
        sizes="64px"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-tight font-bold text-ink-900">{line.name}</p>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.name} from cart`}
            className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-chili-50 hover:text-chili-600"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <p className="tabular text-xs text-ink-500">
          {formatMoneyCompact(line.price)} × {line.quantity}
        </p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full bg-cream-100 p-1">
            <button
              type="button"
              aria-label={`Decrease ${line.name}`}
              onClick={() => onChangeQuantity(line.quantity - 1)}
              className="grid size-8 place-items-center rounded-full bg-white text-ink-700 shadow-sm transition-transform active:scale-95"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="tabular w-6 text-center text-sm font-bold">{line.quantity}</span>
            <button
              type="button"
              aria-label={`Increase ${line.name}`}
              onClick={() => onChangeQuantity(line.quantity + 1)}
              className="grid size-8 place-items-center rounded-full bg-brand-500 text-white shadow-sm transition-transform active:scale-95"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          <p className="tabular text-sm font-extrabold text-ink-900">
            {formatMoneyCompact(line.price * line.quantity)}
          </p>
        </div>
      </div>
    </li>
  )
}
