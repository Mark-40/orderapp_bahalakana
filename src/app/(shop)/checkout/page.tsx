import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CheckoutForm } from '@/components/customer/checkout-form'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <div className="min-h-dvh pb-6">
      <header className="safe-top border-b border-cream-200 bg-cream-50 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Link
            href="/"
            aria-label="Back to menu"
            className="-ml-2 grid size-10 place-items-center rounded-full text-ink-700 transition-colors hover:bg-cream-200"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-extrabold text-ink-900">Complete your order</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <CheckoutForm />
      </main>
    </div>
  )
}
