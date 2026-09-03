import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-cream-200 text-2xl">
          <span aria-hidden>🔎</span>
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-ink-900">Page not found</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          That link may be out of date, or the order number does not exist.
        </p>
        <Button asChild block className="mt-5">
          <Link href="/">Back to menu</Link>
        </Button>
      </div>
    </div>
  )
}
