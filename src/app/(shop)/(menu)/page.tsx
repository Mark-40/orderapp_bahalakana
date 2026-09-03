import { CartDrawer } from '@/components/customer/cart-drawer'
import { MenuBrowser, type MenuCategory } from '@/components/customer/menu-browser'
import { SiteHeader } from '@/components/customer/site-header'
import { prisma } from '@/lib/db'

// The menu changes whenever the admin edits it, so render per request.
export const dynamic = 'force-dynamic'

const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Bahala ka na'

async function getMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      menuItems: {
        orderBy: [{ isAvailable: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
        },
      },
    },
  })

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      items: category.menuItems,
    }))
    // An empty category is noise for the customer.
    .filter((category) => category.items.length > 0)
}

export default async function MenuPage() {
  const categories = await getMenu()

  return (
    <div className="min-h-dvh pb-28">
      <SiteHeader businessName={BUSINESS_NAME} hour={new Date().getHours()} />

      <main className="mx-auto max-w-4xl px-4">
        <MenuBrowser categories={categories} />
      </main>

      <CartDrawer />
    </div>
  )
}
