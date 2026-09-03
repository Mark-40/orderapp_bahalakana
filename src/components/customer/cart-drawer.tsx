'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { EmptyState } from '@/components/ui/states'
import { formatMoneyCompact } from '@/lib/money'
import { revalidateCartAction } from '@/server/actions/checkout'
import { useCart } from '@/store/cart'
import { CartItem } from './cart-item'

/**
 * The cart, plus the sticky bar that opens it.
 *
 * On open the cart re-checks itself against the server: prices refresh and
 * items that went unavailable are flagged before the customer invests time in
 * the checkout form.
 */
export function CartDrawer() {
  const router = useRouter()
  const { lines, ready, itemCount, subtotal, setQuantity, remove, removeMany, reprice } = useCart()
  const [open, setOpen] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [blocked, setBlocked] = React.useState<string[]>([])

  const syncWithServer = React.useCallback(async () => {
    if (lines.length === 0) return
    setChecking(true)
    try {
      const result = await revalidateCartAction(lines.map((l) => l.menuItemId))

      const changed = lines.filter(
        (l) => typeof result.prices[l.menuItemId] === 'number' && result.prices[l.menuItemId] !== l.price,
      )
      if (changed.length > 0) {
        reprice(result.prices)
        const first = changed[0]!
        toast.info(
          changed.length === 1
            ? `The price of ${first.name} has changed. Your cart has been updated.`
            : `${changed.length} prices changed. Your cart has been updated.`,
        )
      }

      if (result.missing.length > 0) {
        const names = lines.filter((l) => result.missing.includes(l.menuItemId)).map((l) => l.name)
        removeMany(result.missing)
        toast.warning(
          `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} no longer on the menu and ${
            names.length === 1 ? 'was' : 'were'
          } removed from your cart.`,
        )
      }

      setBlocked(result.unavailable)
    } catch {
      // Offline or server hiccup — checkout re-validates anyway, so keep going.
    } finally {
      setChecking(false)
    }
  }, [lines, reprice, removeMany])

  // Opening the cart is an event, not state synchronisation, so the freshness
  // check hangs off the open handler rather than an effect. That also keeps it
  // from re-firing every time a quantity changes while the sheet is open.
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) void syncWithServer()
  }

  const blockedLines = lines.filter((l) => blocked.includes(l.menuItemId))
  const canProceed = lines.length > 0 && blockedLines.length === 0

  function handleProceed() {
    if (!canProceed) return
    setOpen(false)
    router.push('/checkout')
  }

  // Hidden until hydrated so the server-rendered HTML and the first client
  // render agree (localStorage is not available during SSR).
  const showBar = ready && itemCount > 0

  return (
    <>
      {showBar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => handleOpenChange(true)}
            className="pointer-events-auto flex w-full max-w-md min-h-14 items-center justify-between gap-3 rounded-2xl bg-ink-900 px-5 text-cream-50 shadow-[var(--shadow-lift)] transition-transform animate-[in-up_0.24s_cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5">
              <span className="relative">
                <ShoppingCart className="size-5" />
                <span className="tabular absolute -top-2 -right-2.5 grid min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
                  {itemCount}
                </span>
              </span>
              <span className="text-sm font-bold">View Cart</span>
            </span>
            <span className="tabular text-base font-extrabold">{formatMoneyCompact(subtotal)}</span>
          </button>
        </div>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader
            title="Your Order"
            description={itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : undefined}
          />

          <div className="flex-1 overflow-y-auto px-4 sm:px-5">
            {lines.length === 0 ? (
              <EmptyState
                className="my-8 border-0 bg-transparent"
                icon={<ShoppingBag className="size-6" />}
                title="Your cart is empty"
                description="Add something tasty from the menu and it will show up here."
                action={
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Browse the menu
                  </Button>
                }
              />
            ) : (
              <>
                {blockedLines.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-chili-100 bg-chili-50 p-3">
                    <p className="text-sm font-semibold text-chili-700">
                      {blockedLines.length === 1
                        ? `${blockedLines[0]!.name} is no longer available.`
                        : 'Some items are no longer available.'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-chili-600">
                      Please remove {blockedLines.length === 1 ? 'it' : 'them'} from your cart before
                      continuing.
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="mt-2.5"
                      onClick={() => {
                        removeMany(blockedLines.map((l) => l.menuItemId))
                        setBlocked([])
                      }}
                    >
                      Remove {blockedLines.length === 1 ? 'it' : 'them'}
                    </Button>
                  </div>
                ) : null}

                <ul className="divide-y divide-cream-200">
                  {lines.map((line) => (
                    <CartItem
                      key={line.menuItemId}
                      line={line}
                      onChangeQuantity={(quantity) => setQuantity(line.menuItemId, quantity)}
                      onRemove={() => remove(line.menuItemId)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          {lines.length > 0 ? (
            <div className="safe-bottom border-t border-cream-200 bg-white px-4 pt-4 sm:px-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-500">Total</span>
                <span className="tabular text-2xl font-extrabold text-ink-900">
                  {formatMoneyCompact(subtotal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-300">
                Final total is confirmed by the shop when your order is received.
              </p>
              <Button
                block
                size="lg"
                className="mt-3"
                loading={checking}
                disabled={!canProceed}
                onClick={handleProceed}
              >
                {checking ? 'Checking availability' : 'Proceed to Order'}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
