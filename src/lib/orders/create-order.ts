import 'server-only'
import { prisma } from '@/lib/db'
import { formatMoneyCompact } from '@/lib/money'
import type { CheckoutInput } from '@/lib/validation/schemas'
import { checkoutSchema } from '@/lib/validation/schemas'
import { nextOrderNumber } from './order-number'

/**
 * Order creation.
 *
 * The browser sends menu item ids and quantities — nothing else about money.
 * Names, prices, availability and every total are re-read from the database
 * here and frozen onto the order, so a tampered payload, a stale tab, or a
 * price change mid-session can never produce a wrong total.
 */

export type CartIssue =
  | { type: 'UNAVAILABLE'; menuItemId: string; name: string }
  | { type: 'REMOVED'; menuItemId: string; name: string }
  | { type: 'PRICE_CHANGED'; menuItemId: string; name: string; oldPrice: number; newPrice: number }

export type CreateOrderResult =
  | { ok: true; orderNumber: string; total: number; duplicate: boolean }
  | { ok: false; reason: 'VALIDATION'; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: 'CART_ISSUES'; issues: CartIssue[]; messages: string[] }
  | { ok: false; reason: 'EMPTY' }

type ClientLine = { menuItemId: string; quantity: number; price?: number }

export async function createOrder(
  raw: unknown,
  /**
   * Prices the customer was shown, keyed by menu item id. Purely advisory —
   * used to tell them "the price changed" rather than to compute anything.
   */
  shownPrices: Record<string, number> = {},
): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return { ok: false, reason: 'VALIDATION', fieldErrors: flat.fieldErrors as Record<string, string[]> }
  }
  const input: CheckoutInput & { items: ClientLine[] } = parsed.data as never

  // Collapse duplicate lines for the same item into a single quantity.
  const quantities = new Map<string, number>()
  for (const line of input.items) {
    quantities.set(line.menuItemId, (quantities.get(line.menuItemId) ?? 0) + line.quantity)
  }
  if (quantities.size === 0) return { ok: false, reason: 'EMPTY' }

  // --- Idempotency: an identical resubmission returns the original order. ---
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    select: { orderNumber: true, total: true },
  })
  if (existing) {
    return { ok: true, orderNumber: existing.orderNumber, total: existing.total, duplicate: true }
  }

  const ids = [...quantities.keys()]
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, price: true, isAvailable: true, category: { select: { isActive: true } } },
  })
  const byId = new Map(menuItems.map((item) => [item.id, item]))

  // --- Re-validate the whole cart against live data. ---
  const issues: CartIssue[] = []
  for (const [menuItemId, quantity] of quantities) {
    const item = byId.get(menuItemId)
    if (!item) {
      issues.push({ type: 'REMOVED', menuItemId, name: 'This item' })
      continue
    }
    if (!item.isAvailable || !item.category.isActive) {
      issues.push({ type: 'UNAVAILABLE', menuItemId, name: item.name })
      continue
    }
    const shown = shownPrices[menuItemId]
    if (typeof shown === 'number' && shown !== item.price) {
      issues.push({
        type: 'PRICE_CHANGED',
        menuItemId,
        name: item.name,
        oldPrice: shown,
        newPrice: item.price,
      })
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, reason: 'EMPTY' }
    }
  }

  if (issues.length > 0) {
    return { ok: false, reason: 'CART_ISSUES', issues, messages: issues.map(describeIssue) }
  }

  // --- Totals, computed from database prices only. ---
  const lines = ids.map((id) => {
    const item = byId.get(id)!
    const quantity = quantities.get(id)!
    return {
      menuItemId: id,
      productName: item.name,
      price: item.price,
      quantity,
      subtotal: item.price * quantity,
    }
  })

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  const total = subtotal // No delivery fee / discounts in the MVP.
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)

  const now = new Date()
  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx, now)
    return tx.order.create({
      data: {
        orderNumber,
        idempotencyKey: parsed.data.idempotencyKey,
        customerName: parsed.data.customerName,
        notes: parsed.data.notes || null,
        fulfillment: 'DELIVERY',
        paymentMethod: parsed.data.paymentMethod,
        paymentReceiptUrl: parsed.data.paymentReceiptUrl || null,
        status: 'PENDING',
        subtotal,
        total,
        itemCount,
        items: { create: lines },
      },
      select: { orderNumber: true, total: true },
    })
  })

  return { ok: true, orderNumber: order.orderNumber, total: order.total, duplicate: false }
}

export function describeIssue(issue: CartIssue): string {
  switch (issue.type) {
    case 'UNAVAILABLE':
      return `${issue.name} is no longer available. Please remove it from your cart before continuing.`
    case 'REMOVED':
      return `${issue.name} is no longer on the menu and was removed from your cart.`
    case 'PRICE_CHANGED':
      return `The price of ${issue.name} changed from ${formatMoneyCompact(issue.oldPrice)} to ${formatMoneyCompact(
        issue.newPrice,
      )}. Your cart has been updated.`
  }
}
