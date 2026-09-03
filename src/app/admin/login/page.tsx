import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Croissant } from 'lucide-react'
import { LoginForm } from '@/components/admin/login-form'
import { getSession } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Admin login' }

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // The middleware only sees whether a cookie exists; this verifies it.
  if (await getSession()) redirect('/admin')

  const { next } = await searchParams

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-brand-50 to-cream-100 px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-sm">
            <Croissant className="size-7" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-ink-900">Shop Admin</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to manage your menu and orders.</p>
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-[var(--shadow-soft)]">
          <LoginForm next={next} />
        </div>

        <p className="mt-5 text-center text-sm">
          <Link href="/" className="font-semibold text-ink-500 underline-offset-4 hover:underline">
            Back to the shop
          </Link>
        </p>
      </main>
    </div>
  )
}
