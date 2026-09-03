import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

try {
  process.loadEnvFile(path.join(process.cwd(), '.env'))
} catch {
  // Real environment variables are already present in CI/production.
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const peso = (amount: number) => Math.round(amount * 100)

const CATEGORIES = [
  { name: 'Breakfast', slug: 'breakfast', description: 'Silogs & rice meals to start the day', sortOrder: 1 },
  { name: 'Snacks', slug: 'snacks', description: 'Quick bites & merienda favourites', sortOrder: 2 },
  { name: 'Add-ons', slug: 'add-ons', description: 'Little extras to complete your order', sortOrder: 3 },
]

type SeedItem = {
  category: string
  name: string
  description: string
  price: number
  isAvailable?: boolean
  imageUrl?: string
}

// Each description begins with #EMOJI:X# so the card gets a bespoke pastel
// placeholder tile until the shop uploads a real photo. Longsilog also carries
// the #LIMITED# marker for the "Limited Edition" chip.
const ITEMS: SeedItem[] = [
  {
    category: 'Breakfast',
    name: 'Spamsilog',
    description: '#EMOJI:🥩# Grilled Spam, garlic rice and a sunny-side-up egg.',
    price: 90,
  },
  {
    category: 'Breakfast',
    name: 'Longsilog',
    description: '#LIMITED##EMOJI:🌭# Sweet longganisa links, garlic rice and a sunny-side-up egg.',
    price: 90,
  },
  {
    category: 'Breakfast',
    name: 'Spam Musubi with Rice & Egg',
    description: '#EMOJI:🍙# Spam musubi bites served with garlic rice and a fried egg.',
    price: 100,
  },
  {
    category: 'Breakfast',
    name: 'Corned Beef Omelette with Rice',
    description: '#EMOJI:🍳# Fluffy omelette folded with sautéed corned beef, served with rice.',
    price: 80,
  },
  {
    category: 'Breakfast',
    name: 'Adobo with Rice',
    description: '#EMOJI:🍛# Tender pork adobo simmered in soy, vinegar and garlic. Served with rice.',
    price: 120,
  },
  {
    category: 'Snacks',
    name: 'Hashbrown',
    description: '#EMOJI:🥔# Golden, crispy potato hashbrown.',
    price: 30,
  },
  {
    category: 'Snacks',
    name: 'Pancit Canton',
    description: '#EMOJI:🍜# Stir-fried instant pancit canton, cooked to order.',
    price: 25,
  },
  {
    category: 'Snacks',
    name: 'Pancit Canton with Egg',
    description: '#EMOJI:🍜# Pancit canton topped with a fried egg.',
    price: 35,
  },
  {
    category: 'Snacks',
    name: 'Egg Sandwich',
    description: '#EMOJI:🥪# Soft white bread filled with creamy egg salad.',
    price: 20,
  },
  {
    category: 'Snacks',
    name: 'Overload Fries',
    description: '#EMOJI:🍟# Loaded fries with cheese sauce and bacon bits.',
    price: 70,
  },
  {
    category: 'Add-ons',
    name: 'Additional Egg',
    description: '#EMOJI:🥚# One extra fried egg on the side.',
    price: 10,
  },
]

async function main() {
  console.log('Seeding database...')

  // --- Admin user -----------------------------------------------------------
  const email = process.env.ADMIN_EMAIL || 'admin@snackshop.test'
  const password = process.env.ADMIN_PASSWORD || 'Admin123!change'
  const name = process.env.ADMIN_NAME || 'Shop Owner'

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash: await bcrypt.hash(password, 12), role: 'ADMIN' },
  })
  console.log(`  admin: ${admin.email}`)

  // --- Categories -----------------------------------------------------------
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
      },
      create: category,
    })
  }
  const categories = await prisma.category.findMany()
  const categoryId = new Map(categories.map((c) => [c.name, c.id]))
  console.log(`  categories: ${categories.length}`)

  // --- Menu items -----------------------------------------------------------
  let sortOrder = 0
  for (const item of ITEMS) {
    const parent = categoryId.get(item.category)
    if (!parent) continue
    await prisma.menuItem.upsert({
      where: { categoryId_name: { categoryId: parent, name: item.name } },
      update: {
        description: item.description,
        price: peso(item.price),
        imageUrl: item.imageUrl ?? null,
        isAvailable: item.isAvailable ?? true,
      },
      create: {
        categoryId: parent,
        name: item.name,
        description: item.description,
        price: peso(item.price),
        imageUrl: item.imageUrl ?? null,
        isAvailable: item.isAvailable ?? true,
        sortOrder: sortOrder++,
      },
    })
  }
  console.log(`  menu items: ${ITEMS.length}`)

  // --- Sample orders --------------------------------------------------------
  // Skipped when orders already exist, so re-seeding never inflates the numbers.
  const existingOrders = await prisma.order.count()
  if (existingOrders === 0) {
    const created = await seedSampleOrders()
    console.log(`  sample orders: ${created}`)
  } else {
    console.log(`  sample orders: skipped (${existingOrders} already present)`)
  }

  console.log('Done.')
}

async function seedSampleOrders(): Promise<number> {
  const items = await prisma.menuItem.findMany({ where: { isAvailable: true } })
  if (items.length === 0) return 0

  const customers: readonly (readonly [string, string])[] = [
    ['Mark Manzanilla', '09171234567'],
    ['Jonas Rivera', '09281234567'],
    ['Aileen Cruz', '09391234567'],
    ['Rico Dela Cruz', '09451234567'],
    ['Bea Santos', '09561234567'],
  ]

  const statuses = [
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'PENDING',
    'PENDING',
    'PREPARING',
    'READY',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'COMPLETED',
  ] as const

  const now = new Date()
  const counters = new Map<string, number>()

  for (let i = 0; i < statuses.length; i++) {
    // Spread across the last three days; most land today.
    const daysAgo = i < 8 ? 0 : i < 10 ? 1 : 2
    const createdAt = new Date(now)
    createdAt.setDate(createdAt.getDate() - daysAgo)
    createdAt.setHours(7 + (i % 10), (i * 7) % 60, 0, 0)

    const day =
      `${createdAt.getFullYear()}` +
      `${String(createdAt.getMonth() + 1).padStart(2, '0')}` +
      `${String(createdAt.getDate()).padStart(2, '0')}`
    const seq = (counters.get(day) ?? 0) + 1
    counters.set(day, seq)

    const picked = [items[i % items.length]!, items[(i * 3 + 1) % items.length]!].filter(
      (item, index, all) => all.findIndex((x) => x.id === item.id) === index,
    )

    const lines = picked.map((item, index) => {
      const quantity = ((i + index) % 3) + 1
      return {
        menuItemId: item.id,
        productName: item.name,
        price: item.price,
        quantity,
        subtotal: item.price * quantity,
      }
    })

    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
    const customer = customers[i % customers.length]!
    const status = statuses[i]!
    const firstName = customer[0].split(' ')[0]!.toLowerCase()

    const paymentMethod = i % 2 === 0 ? 'CASH' : 'GCASH'
    await prisma.order.create({
      data: {
        orderNumber: `ORD-${day}-${String(seq).padStart(3, '0')}`,
        idempotencyKey: `seed-${day}-${seq}`,
        customerName: customer[0],
        customerPhone: customer[1],
        customerEmail: i % 3 === 0 ? `${firstName}@example.com` : null,
        notes: i % 4 === 0 ? 'Please leave at the gate.' : null,
        fulfillment: 'DELIVERY',
        paymentMethod,
        paymentReceiptUrl: paymentMethod === 'GCASH' ? '/gcash-qr.svg' : null,
        status,
        subtotal,
        total: subtotal,
        itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        createdAt,
        updatedAt: createdAt,
        completedAt: status === 'COMPLETED' ? createdAt : null,
        cancelledAt: status === 'CANCELLED' ? createdAt : null,
        items: { create: lines },
      },
    })

    await prisma.orderCounter.upsert({
      where: { day },
      create: { day, last: seq },
      update: { last: seq },
    })
  }

  return statuses.length
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
