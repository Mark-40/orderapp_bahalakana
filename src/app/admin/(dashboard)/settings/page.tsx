import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, LogOut } from 'lucide-react'
import { ChangePasswordForm } from '@/components/admin/change-password-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { formatDateTime } from '@/lib/utils'
import { logoutAction } from '@/server/actions/auth'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const session = await requireAdmin()

  const [user, counts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, email: true, role: true, lastLoginAt: true, createdAt: true },
    }),
    Promise.all([
      prisma.menuItem.count(),
      prisma.category.count(),
      prisma.order.count(),
    ]).then(([menuItems, categories, orders]) => ({ menuItems, categories, orders })),
  ])

  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Bahala ka na'
  const storageDriver = process.env.STORAGE_DRIVER || 'local'

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-ink-900">Settings</h1>
        <p className="mt-0.5 text-sm text-ink-500">Your account and shop configuration.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as {user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Row label="Name" value={user?.name ?? session.name} />
            <Row label="Role" value={<Badge tone="brand">{user?.role ?? session.role}</Badge>} />
            <Row
              label="Last sign-in"
              value={user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'This is your first'}
            />
            <div className="pt-2">
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shop</CardTitle>
            <CardDescription>Configured through environment variables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Row label="Business name" value={businessName} />
            <Row label="Currency" value="Philippine Peso (₱)" />
            <Row label="Image storage" value={<Badge tone="neutral">{storageDriver}</Badge>} />
            <Row label="Categories" value={String(counts.categories)} />
            <Row label="Menu items" value={String(counts.menuItems)} />
            <Row label="Orders all-time" value={String(counts.orders)} />
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/" target="_blank">
                  View customer menu
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Use a password you do not use anywhere else. You stay signed in afterwards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <ChangePasswordForm />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-semibold text-ink-900">{value}</span>
    </div>
  )
}
