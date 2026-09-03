'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { createOrder, type CartIssue } from '@/lib/orders/create-order'
import { orderRateLimit } from '@/lib/rate-limit'

export type CheckoutResult =
  | { status: 'success'; orderNumber: string; total: number }
  | { status: 'invalid'; fieldErrors: Record<string, string[]>; message?: string }
  | { status: 'cart-issues'; issues: CartIssue[]; messages: string[] }
  | { status: 'error'; message: string }

/**
 * The single public write endpoint. The payload carries item ids, quantities
 * and customer details — no prices — and everything monetary is recomputed
 * server-side before anything is written.
 */
export async function submitOrderAction(payload: unknown): Promise<CheckoutResult> {
  try {
    const headerList = await headers()
    const ip =
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headerList.get('x-real-ip') ||
      'unknown'

    const limit = orderRateLimit(ip)
    if (!limit.ok) {
      return {
        status: 'error',
        message: `You have placed several orders in a short time. Please wait about ${Math.ceil(
          limit.retryAfterSeconds / 60,
        )} minute(s) before ordering again.`,
      }
    }

    const body = payload as { shownPrices?: Record<string, number> } | null
    const result = await createOrder(payload, body?.shownPrices ?? {})

    if (result.ok) {
      revalidatePath('/admin')
      revalidatePath('/admin/orders')
      return { status: 'success', orderNumber: result.orderNumber, total: result.total }
    }

    switch (result.reason) {
      case 'VALIDATION':
        return { status: 'invalid', fieldErrors: result.fieldErrors }
      case 'CART_ISSUES':
        return { status: 'cart-issues', issues: result.issues, messages: result.messages }
      case 'EMPTY':
        return {
          status: 'invalid',
          fieldErrors: {},
          message: 'Your cart is empty. Add something from the menu first.',
        }
    }
  } catch (error) {
    console.error('[submitOrderAction]', error)
    return {
      status: 'error',
      message: 'We could not place your order right now. Please check your connection and try again.',
    }
  }
}

/**
 * Lets the cart drawer re-check itself against live data before the customer
 * commits, so unavailable items and price changes surface early rather than as
 * a rejection at submit time.
 */
export async function revalidateCartAction(
  menuItemIds: string[],
): Promise<{ prices: Record<string, number>; unavailable: string[]; missing: string[] }> {
  const ids = [...new Set(menuItemIds)].filter((id) => typeof id === 'string').slice(0, 50)
  if (ids.length === 0) return { prices: {}, unavailable: [], missing: [] }

  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, price: true, isAvailable: true, category: { select: { isActive: true } } },
  })

  const prices: Record<string, number> = {}
  const unavailable: string[] = []
  const found = new Set<string>()

  for (const item of items) {
    found.add(item.id)
    prices[item.id] = item.price
    if (!item.isAvailable || !item.category.isActive) unavailable.push(item.id)
  }

  return { prices, unavailable, missing: ids.filter((id) => !found.has(id)) }
}
