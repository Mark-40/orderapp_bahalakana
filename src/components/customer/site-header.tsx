import Link from 'next/link'
import { Croissant } from 'lucide-react'

/** Time-of-day greeting — small touch that makes the shop feel staffed. */
function greeting(hour: number): { text: string; emoji: string } {
  if (hour < 11) return { text: 'Good morning', emoji: '☀️' }
  if (hour < 15) return { text: 'Good afternoon', emoji: '🌤️' }
  if (hour < 18) return { text: 'Merienda time', emoji: '🍩' }
  return { text: 'Good evening', emoji: '🌙' }
}

export function SiteHeader({ businessName, hour }: { businessName: string; hour: number }) {
  const { text, emoji } = greeting(hour)

  return (
    <header className="safe-top relative overflow-hidden px-4 pt-6 pb-8">
      <div
        aria-hidden
        className="bg-brand-gradient absolute inset-x-0 top-0 h-full opacity-90"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-cream-100"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-white/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-10 size-56 rounded-full bg-white/20 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-4xl items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/90 text-brand-600 shadow-[var(--shadow-soft)] backdrop-blur">
          <Croissant className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-wide text-white/85 uppercase">
            {text} <span aria-hidden>{emoji}</span>
          </p>
          <Link href="/" className="block">
            <h1 className="truncate text-2xl leading-tight font-extrabold text-white drop-shadow-sm">
              {businessName}
            </h1>
          </Link>
        </div>
      </div>
    </header>
  )
}
