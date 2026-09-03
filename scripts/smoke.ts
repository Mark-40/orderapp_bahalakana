/**
 * End-to-end smoke test against a running server + real database.
 *
 * Covers the business rules that are easy to break and expensive to get wrong:
 * server-side pricing, availability re-checks, idempotency, order numbering,
 * historical price preservation, and admin route protection.
 *
 * Run with:  npm run smoke   (server must be running on SMOKE_URL)
 */
import path from 'node:path'
import { SignJWT } from 'jose'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

process.loadEnvFile(path.join(process.cwd(), '.env'))

const BASE = process.env.SMOKE_URL || 'http://localhost:3100'
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function sessionCookie(): Promise<string> {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })
  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({ email: admin.email, name: admin.name, role: admin.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!))
  return `orderapp_session=${token}`
}

async function main() {
  console.log(`\nSmoke test against ${BASE}\n`)

  // ---------------------------------------------------------------- routes --
  console.log('Public routes')
  const menu = await fetch(BASE)
  check('menu page returns 200', menu.status === 200)
  const menuHtml = await menu.text()
  check('menu lists a seeded item', menuHtml.includes('Chicken Sandwich'))
  check('unavailable item is marked, not hidden', menuHtml.includes('Cheese Sticks') && menuHtml.includes('Unavailable'))

  const checkout = await fetch(`${BASE}/checkout`)
  check('checkout page returns 200', checkout.status === 200)

  // Next 16 flushes the response shell before notFound() resolves on a
  // dynamically-rendered route, so the status stays 200; what matters is that
  // the visitor gets the not-found page rather than a broken or blank one.
  const missing = await fetch(`${BASE}/order/ORD-00000000-999`)
  check('unknown order number shows the not-found page', (await missing.text()).includes('Page not found'))

  // ------------------------------------------------------------ admin gate --
  console.log('\nAdmin protection')
  for (const route of ['/admin', '/admin/orders', '/admin/menu', '/admin/categories', '/admin/settings']) {
    const res = await fetch(`${BASE}${route}`, { redirect: 'manual' })
    const location = res.headers.get('location') ?? ''
    check(`${route} redirects anonymous users to login`, res.status === 307 && location.includes('/admin/login'))
  }

  const cookie = await sessionCookie()
  console.log('\nAdmin pages (authenticated)')
  for (const route of ['/admin', '/admin/orders', '/admin/menu', '/admin/categories', '/admin/settings']) {
    const res = await fetch(`${BASE}${route}`, { headers: { cookie } })
    check(`${route} renders for a signed-in admin`, res.status === 200)
  }

  const forged = await fetch(`${BASE}/admin`, {
    headers: { cookie: 'orderapp_session=not.a.real.token' },
    redirect: 'manual',
  })
  check(
    'a forged session cookie is rejected',
    forged.status === 307 && (forged.headers.get('location') ?? '').includes('/admin/login'),
    `got ${forged.status}`,
  )

  // ------------------------------------------------------- order creation --
  console.log('\nOrder pipeline')
  const { createOrder } = await import('../src/lib/orders/create-order.js')

  const sandwich = await prisma.menuItem.findFirstOrThrow({ where: { name: 'Chicken Sandwich' } })
  const pancit = await prisma.menuItem.findFirstOrThrow({ where: { name: 'Pancit Canton' } })
  const soldOut = await prisma.menuItem.findFirstOrThrow({ where: { isAvailable: false } })

  const key = `smoke-${Date.now()}`
  const base = {
    customerName: 'Smoke Tester',
    customerPhone: '0917 123 4567',
    customerEmail: '',
    notes: 'automated smoke test',
    fulfillment: 'PICKUP' as const,
    deliveryAddress: '',
  }

  const created = await createOrder({
    ...base,
    idempotencyKey: key,
    items: [
      { menuItemId: sandwich.id, quantity: 2 },
      { menuItemId: pancit.id, quantity: 1 },
    ],
  })

  check('order is created', created.ok === true)
  if (!created.ok) throw new Error('cannot continue without an order')

  const expected = sandwich.price * 2 + pancit.price * 1
  check(
    'total is computed from database prices',
    created.total === expected,
    `expected ${expected}, got ${created.total}`,
  )
  check(
    'order number matches ORD-YYYYMMDD-NNN',
    /^ORD-\d{8}-\d{3}$/.test(created.orderNumber),
    created.orderNumber,
  )

  // A tampered payload must not influence the total.
  const tampered = await createOrder({
    ...base,
    idempotencyKey: `${key}-tampered`,
    items: [{ menuItemId: sandwich.id, quantity: 1, price: 1, subtotal: 1 }],
    subtotal: 1,
    total: 1,
  } as never)
  check(
    'client-supplied prices are ignored',
    tampered.ok === true && tampered.total === sandwich.price,
    tampered.ok ? `got ${tampered.total}, expected ${sandwich.price}` : 'order rejected',
  )

  // Replaying the same idempotency key must not create a second order.
  const replay = await createOrder({
    ...base,
    idempotencyKey: key,
    items: [{ menuItemId: sandwich.id, quantity: 2 }, { menuItemId: pancit.id, quantity: 1 }],
  })
  check(
    'replaying an idempotency key returns the original order',
    replay.ok === true && replay.duplicate === true && replay.orderNumber === created.orderNumber,
  )

  const unavailable = await createOrder({
    ...base,
    idempotencyKey: `${key}-unavailable`,
    items: [{ menuItemId: soldOut.id, quantity: 1 }],
  })
  check(
    'unavailable items are refused',
    unavailable.ok === false && unavailable.reason === 'CART_ISSUES',
  )

  const badQuantity = await createOrder({
    ...base,
    idempotencyKey: `${key}-bad-qty`,
    items: [{ menuItemId: sandwich.id, quantity: 0 }],
  })
  check('zero quantity is refused', badQuantity.ok === false)

  const negative = await createOrder({
    ...base,
    idempotencyKey: `${key}-negative`,
    items: [{ menuItemId: sandwich.id, quantity: -3 }],
  })
  check('negative quantity is refused', negative.ok === false)

  const fractional = await createOrder({
    ...base,
    idempotencyKey: `${key}-fractional`,
    items: [{ menuItemId: sandwich.id, quantity: 1.5 }],
  })
  check('fractional quantity is refused', fractional.ok === false)

  const badPhone = await createOrder({
    ...base,
    customerPhone: '12345',
    idempotencyKey: `${key}-phone`,
    items: [{ menuItemId: sandwich.id, quantity: 1 }],
  })
  check('an invalid phone number is refused', badPhone.ok === false && badPhone.reason === 'VALIDATION')

  const emptyCart = await createOrder({
    ...base,
    idempotencyKey: `${key}-empty`,
    items: [],
  })
  check('an empty cart is refused', emptyCart.ok === false)

  // --------------------------------------------------- historical accuracy --
  console.log('\nHistorical price preservation')
  const originalPrice = sandwich.price
  await prisma.menuItem.update({ where: { id: sandwich.id }, data: { price: originalPrice + 1000 } })

  const stored = await prisma.order.findUniqueOrThrow({
    where: { orderNumber: created.orderNumber },
    include: { items: true },
  })
  const line = stored.items.find((i) => i.productName === sandwich.name)!
  check('the order keeps the price it was placed at', line.price === originalPrice)
  check('the order total is unchanged by a re-price', stored.total === expected)

  // Deleting the item must not damage the historical record.
  const throwaway = await prisma.menuItem.create({
    data: {
      name: `Smoke Item ${Date.now()}`,
      categoryId: sandwich.categoryId,
      price: 9900,
      isAvailable: true,
    },
  })
  const withThrowaway = await createOrder({
    ...base,
    idempotencyKey: `${key}-delete`,
    items: [{ menuItemId: throwaway.id, quantity: 1 }],
  })
  check('order containing the throwaway item is created', withThrowaway.ok === true)

  await prisma.menuItem.delete({ where: { id: throwaway.id } })

  if (withThrowaway.ok) {
    const afterDelete = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: withThrowaway.orderNumber },
      include: { items: true },
    })
    check('the order survives deleting the menu item', afterDelete.items.length === 1)
    check('its product name is preserved', afterDelete.items[0]!.productName === throwaway.name)
    check('its price is preserved', afterDelete.items[0]!.price === 9900)
    check('the menu item link is nulled, not cascaded', afterDelete.items[0]!.menuItemId === null)
  }

  // ------------------------------------------------------------- reporting --
  console.log('\nDashboard calculations')
  const { getDashboardStats } = await import('../src/lib/dashboard/stats.js')
  const { resolveRange } = await import('../src/lib/dashboard/date-range.js')
  const stats = await getDashboardStats(resolveRange('today'))

  const todayOrders = await prisma.order.findMany({
    where: { createdAt: { gte: resolveRange('today').from, lte: resolveRange('today').to } },
    select: { total: true, status: true },
  })
  const manualSales = todayOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.total, 0)

  check('total orders matches the database', stats.totalOrders === todayOrders.length)
  check(
    'total sales excludes cancelled orders',
    stats.totalSales === manualSales,
    `expected ${manualSales}, got ${stats.totalSales}`,
  )
  const revenueCount = todayOrders.filter((o) => o.status !== 'CANCELLED').length
  const expectedAov = revenueCount > 0 ? Math.round(manualSales / revenueCount) : 0
  check('average order value is sales / orders', stats.averageOrderValue === expectedAov)

  // ------------------------------------------------------------- teardown ---
  await prisma.menuItem.update({ where: { id: sandwich.id }, data: { price: originalPrice } })
  await prisma.order.deleteMany({ where: { idempotencyKey: { startsWith: 'smoke-' } } })

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
