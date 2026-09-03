'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/** Catches render/data errors anywhere in the app and offers a way forward. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-chili-100 text-2xl">
          <span aria-hidden>😕</span>
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-ink-900">Something went wrong.</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Please try again. If it keeps happening, refresh the page in a moment.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={reset} block>
            Try again
          </Button>
          <Button asChild variant="ghost" block>
            <Link href="/">Back to menu</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="mt-4 text-xs text-ink-300">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  )
}
