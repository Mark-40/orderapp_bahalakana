import * as React from 'react'
import { cn } from '@/lib/utils'

/* --------------------------------------------------------------------------
   Shared empty / error / loading states, so every screen handles the
   uninteresting cases the same way.
   -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-200 bg-white/60 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 grid size-14 place-items-center rounded-full bg-cream-200 text-ink-500">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-bold text-ink-900">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong.',
  description = 'Please try again.',
  action,
}: {
  title?: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-chili-100 bg-chili-50 px-5 py-6 text-center">
      <p className="text-base font-bold text-chili-700">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-chili-600">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-cream-200', className)} />
}

export function MenuSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading menu">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-cream-200 bg-white p-3">
          <Skeleton className="size-24 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}
