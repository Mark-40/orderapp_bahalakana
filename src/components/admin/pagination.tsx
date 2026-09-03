'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (pageCount <= 1) {
    return (
      <p className="pt-2 text-center text-xs text-ink-500">
        {total} order{total === 1 ? '' : 's'}
      </p>
    )
  }

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Order list pages"
      className="flex items-center justify-between gap-3 pt-2"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
        Prev
      </Button>

      <p className="tabular text-xs text-ink-500">
        {first}–{last} of {total}
      </p>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => goTo(page + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  )
}
