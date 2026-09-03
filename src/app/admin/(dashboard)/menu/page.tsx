import type { Metadata } from 'next'
import { MenuManager, type MenuRow } from '@/components/admin/menu-manager'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'Menu' }
export const dynamic = 'force-dynamic'

export default async function AdminMenuPage() {
  const [items, categories] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        sortOrder: true,
        category: { select: { name: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ])

  const rows: MenuRow[] = items.map(({ category, ...item }) => ({
    ...item,
    categoryName: category.name,
  }))

  const availableCount = rows.filter((row) => row.isAvailable).length

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-ink-900">Menu Items</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {rows.length} item{rows.length === 1 ? '' : 's'} · {availableCount} available
        </p>
      </header>

      <MenuManager items={rows} categories={categories} />
    </div>
  )
}
