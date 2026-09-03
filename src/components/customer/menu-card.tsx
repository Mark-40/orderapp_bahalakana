'use client'

import { Check, Minus, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SmartImage } from '@/components/ui/smart-image'
import { formatMoneyCompact } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCart } from '@/store/cart'

export type MenuCardItem = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  isAvailable: boolean
}

const LIMITED_MARKER = '#LIMITED#'
const EMOJI_MARKER = /^#EMOJI:([^#]+)#\s*/

/**
 * Menu items encode a couple of pieces of metadata as leading markers in the
 * description, so the DB schema stays stable while the customer UI can still
 * flag "limited edition" chips and per-item fallback art without a photo:
 *   #LIMITED#      — render the Limited Edition chip
 *   #EMOJI:🌭#     — use this emoji as the image placeholder
 * Both markers can appear in any order at the start of the description; the
 * remainder is shown as the customer-facing copy.
 */
function parseMarkers(description: string | null): {
  limited: boolean
  emoji: string | null
  text: string | null
} {
  if (!description) return { limited: false, emoji: null, text: null }
  let rest = description
  let limited = false
  let emoji: string | null = null
  for (let i = 0; i < 3; i++) {
    if (rest.startsWith(LIMITED_MARKER)) {
      limited = true
      rest = rest.slice(LIMITED_MARKER.length).trimStart()
      continue
    }
    const match = rest.match(EMOJI_MARKER)
    if (match) {
      emoji = match[1]!.trim()
      rest = rest.slice(match[0].length)
      continue
    }
    break
  }
  const trimmed = rest.trim()
  return { limited, emoji, text: trimmed.length > 0 ? trimmed : null }
}

/**
 * A single menu row. Unavailable items stay visible (so customers know what
 * the shop sells) but are visually muted and cannot be added — the guard lives
 * here for UX and again on the server at checkout.
 */
export function MenuCard({ item, categoryEmoji }: { item: MenuCardItem; categoryEmoji?: string }) {
  const { add, setQuantity, quantityOf } = useCart()
  const quantity = quantityOf(item.id)
  const { limited, emoji, text: description } = parseMarkers(item.description)

  function handleAdd() {
    if (!item.isAvailable) return
    add({ menuItemId: item.id, name: item.name, price: item.price, imageUrl: item.imageUrl })
    toast.success(`${item.name} added`, { duration: 1600 })
  }

  return (
    <article
      className={cn(
        'flex gap-3 rounded-[var(--radius-card)] border border-white/70 bg-white/85 p-3 shadow-[var(--shadow-soft)] backdrop-blur-sm transition-all',
        item.isAvailable
          ? 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]'
          : 'opacity-70',
      )}
    >
      <SmartImage
        src={item.imageUrl}
        alt={item.name}
        fallbackEmoji={emoji ?? categoryEmoji}
        sizes="(max-width: 640px) 96px, 128px"
        className={cn(
          'size-24 shrink-0 rounded-2xl sm:size-28',
          !item.isAvailable && 'grayscale',
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] leading-tight font-bold text-ink-900">{item.name}</h3>
            {limited ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-sm">
                <Sparkles className="size-3" aria-hidden />
                Limited Edition
              </span>
            ) : null}
          </div>
          {!item.isAvailable ? (
            <Badge tone="muted" className="shrink-0">
              Unavailable
            </Badge>
          ) : null}
        </div>

        {description ? (
          <p className="line-clamp-2-safe mt-1 text-[13px] leading-snug text-ink-500">
            {description}
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="tabular text-lg font-extrabold text-ink-900">
            {formatMoneyCompact(item.price)}
          </p>

          {!item.isAvailable ? (
            <span className="text-xs font-semibold text-ink-300">Sold out</span>
          ) : quantity > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-brand-50 p-1 ring-1 ring-brand-100">
              <button
                type="button"
                aria-label={`Remove one ${item.name}`}
                onClick={() => setQuantity(item.id, quantity - 1)}
                className="grid size-9 place-items-center rounded-full bg-white text-brand-700 shadow-sm transition-transform active:scale-95"
              >
                <Minus className="size-4" />
              </button>
              <span
                className="tabular w-7 text-center text-sm font-bold text-brand-700"
                aria-label={`${quantity} in cart`}
              >
                {quantity}
              </span>
              <button
                type="button"
                aria-label={`Add one more ${item.name}`}
                onClick={() => setQuantity(item.id, quantity + 1)}
                className="grid size-9 place-items-center rounded-full bg-brand-500 text-white shadow-sm transition-transform active:scale-95 hover:bg-brand-600"
              >
                <Plus className="size-4" />
              </button>
            </div>
          ) : (
            <Button size="sm" onClick={handleAdd} className="min-h-9 gap-1 rounded-full px-3.5">
              <Plus className="size-4" />
              Add
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

/** Compact confirmation used in the cart drawer after a successful update. */
export function AddedTick() {
  return <Check className="size-4 text-leaf-600" aria-hidden />
}
