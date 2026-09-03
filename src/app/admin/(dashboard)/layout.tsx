import { AdminBottomNav, AdminSidebar, AdminTopBar } from '@/components/admin/admin-nav'
import { requireAdmin } from '@/lib/auth/guard'

/**
 * Shell for every authenticated admin page.
 *
 * `requireAdmin()` runs here on the server for the whole segment — the
 * middleware redirect is only a fast path, this is the real gate.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="flex min-h-dvh bg-cream-100">
      <AdminSidebar userName={user.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar userName={user.name} />
        {/* Bottom padding clears the mobile tab bar. */}
        <main className="flex-1 px-4 py-5 pb-24 lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <AdminBottomNav />
    </div>
  )
}
