import * as React from 'react'
import { cn } from '@/lib/utils'

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-leaf-100 text-leaf-700',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-sky-100 text-sky-800',
  neutral: 'bg-cream-200 text-ink-700',
} as const

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
  tone?: keyof typeof TONES
}) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</p>
        {icon ? (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', TONES[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="tabular mt-2 text-2xl leading-none font-extrabold text-ink-900 sm:text-[28px]">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  )
}
