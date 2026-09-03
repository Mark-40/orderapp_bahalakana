import type { Metadata } from 'next'
import { CategoryManager, type CategoryRow } from '@/components/admin/category-manager'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'Categories' }
export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { menuItems: true } },
    },
  })

  const rows: CategoryRow[] = categories.map(({ _count, ...category }) => ({
    ...category,
    itemCount: _count.menuItems,
  }))

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-ink-900">Categories</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Arrange how sections appear on the customer menu.
        </p>
      </header>

      <CategoryManager categories={rows} />
    </div>
  )
}
