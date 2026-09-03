import * as React from 'react'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  /** Hide on narrow screens where the card layout carries the information. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

/**
 * Responsive table.
 *
 * On phones a table with six columns is unusable, so the same rows render as
 * stacked cards via `renderCard` and the real <table> only appears from `md`
 * up. One data source, two presentations.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  renderCard,
  empty,
  caption,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  renderCard: (row: T) => React.ReactNode
  empty: React.ReactNode
  caption?: string
}) {
  if (rows.length === 0) return <>{empty}</>

  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <React.Fragment key={rowKey(row)}>{renderCard(row)}</React.Fragment>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-cream-200 bg-white shadow-[var(--shadow-soft)] md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-bold tracking-wide text-ink-500 uppercase',
                    column.hideBelow === 'lg' && 'hidden lg:table-cell',
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-cream-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle text-ink-700',
                      column.hideBelow === 'lg' && 'hidden lg:table-cell',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
