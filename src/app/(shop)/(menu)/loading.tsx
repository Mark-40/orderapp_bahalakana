import { MenuSkeleton, Skeleton } from '@/components/ui/states'

/**
 * Menu-page skeleton. It lives inside the (menu) route group rather than at
 * the (shop) level so that /checkout and /order/[orderNumber] have no Suspense
 * boundary above them — with one, Next flushes a 200 shell before the page
 * resolves and notFound() could no longer set a real 404 status.
 */
export default function MenuLoading() {
  return (
    <div className="min-h-dvh">
      <div className="safe-top bg-gradient-to-b from-brand-50 to-cream-100 px-4 pt-5 pb-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Skeleton className="size-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 pt-4">
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <MenuSkeleton />
      </div>
    </div>
  )
}
