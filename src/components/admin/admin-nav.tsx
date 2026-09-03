'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Croissant, LayoutDashboard, LogOut, Receipt, Settings, Tags, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/server/actions/auth'

const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: Receipt, exact: false },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, exact: false },
  { href: '/admin/categories', label: 'Categories', icon: Tags, exact: false },
  { href: '/admin/settings', label: 'Settings', icon: Settings, exact: false },
] as const

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

/** Persistent sidebar, shown from `lg` up. */
export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-cream-200 bg-white lg:flex">
      <div className="flex items-center gap-2.5 border-b border-cream-200 px-5 py-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-white">
          <Croissant className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-ink-900">Shop Admin</p>
          <p className="truncate text-xs text-ink-500">{userName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href, link.exact)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-700 hover:bg-cream-100 hover:text-ink-900',
              )}
            >
              <link.icon className="size-[18px] shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-cream-200 p-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-500 transition-colors hover:bg-chili-50 hover:text-chili-700"
          >
            <LogOut className="size-[18px] shrink-0" />
            Logout
          </button>
        </form>
      </div>
    </aside>
  )
}

/**
 * Bottom tab bar for phones. Settings and Logout live on the Settings page, so
 * the bar stays at four comfortable touch targets instead of six cramped ones.
 */
export function AdminBottomNav() {
  const pathname = usePathname()
  const tabs = LINKS.slice(0, 4)

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-cream-200 bg-white/95 pt-1 backdrop-blur-sm lg:hidden">
      {tabs.map((link) => {
        const active = isActive(pathname, link.href, link.exact)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
              active ? 'text-brand-600' : 'text-ink-500',
            )}
          >
            <link.icon className="size-5" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Compact top bar for phones — page title on the left, logout on the right. */
export function AdminTopBar({ userName }: { userName: string }) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-cream-200 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-white">
          <Croissant className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-ink-900">Shop Admin</p>
          <p className="truncate text-[11px] text-ink-500">{userName}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href="/admin/settings"
          aria-label="Settings"
          className="grid size-10 place-items-center rounded-full text-ink-500 transition-colors hover:bg-cream-100"
        >
          <Settings className="size-5" />
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Logout"
            className="grid size-10 place-items-center rounded-full text-ink-500 transition-colors hover:bg-chili-50 hover:text-chili-700"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
    </header>
  )
}
