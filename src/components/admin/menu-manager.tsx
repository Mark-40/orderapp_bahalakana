'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Search, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input, Select } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/states'
import { SmartImage } from '@/components/ui/smart-image'
import { centavosToPesos, formatMoneyCompact } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  deleteMenuItemAction,
  setAvailabilityAction,
  updatePriceAction,
} from '@/server/actions/menu'
import { MenuItemDialog, type CategoryOption, type MenuItemDraft } from './menu-item-dialog'

export type MenuRow = MenuItemDraft & { categoryName: string }

/**
 * Menu management.
 *
 * Availability and price are the two things a shop owner changes constantly, so
 * both are editable inline on the row — no dialog, one tap. Everything else
 * lives in the edit dialog.
 */
export function MenuManager({
  items,
  categories,
}: {
  items: MenuRow[]
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MenuItemDraft | undefined>(undefined)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryFilter && item.categoryId !== categoryFilter) return false
      if (!term) return true
      return (
        item.name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)
      )
    })
  }, [items, query, categoryFilter])

  async function toggleAvailability(item: MenuRow) {
    setBusyId(item.id)
    try {
      const result = await setAvailabilityAction(item.id, !item.isAvailable)
      if (result.ok) {
        toast.success(result.message ?? 'Updated.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Could not update availability.')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function remove(item: MenuRow) {
    const result = await deleteMenuItemAction(item.id)
    if (result.ok) {
      toast.success(result.message ?? 'Deleted.')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Could not delete that item.')
    }
  }

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(item: MenuRow) {
    setEditing(item)
    setDialogOpen(true)
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={<UtensilsCrossed className="size-6" />}
        title="Create a category first"
        description="Menu items live inside categories like Breakfast or Drinks. Add one, then come back here."
        action={
          <Button onClick={() => router.push('/admin/categories')}>Go to Categories</Button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search menu items"
            aria-label="Search menu items"
            type="search"
            className="pl-10"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter by category"
          className="sm:w-48"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Button onClick={openCreate} className="sm:w-36">
          <Plus className="size-4" />
          Add item
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="size-6" />}
          title={items.length === 0 ? 'No menu items yet' : 'Nothing matches that search'}
          description={
            items.length === 0
              ? 'Add your first item and it will show up on the customer menu straight away.'
              : 'Try a different search term or category.'
          }
          action={
            items.length === 0 ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add item
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={cn(
                'rounded-2xl border border-cream-200 bg-white p-3 shadow-[var(--shadow-soft)] transition-opacity',
                !item.isAvailable && 'opacity-75',
              )}
            >
              <div className="flex gap-3">
                <SmartImage
                  src={item.imageUrl}
                  alt={item.name}
                  className={cn('size-16 shrink-0 rounded-xl', !item.isAvailable && 'grayscale')}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-ink-900">{item.name}</p>
                    <Badge tone="neutral">{item.categoryName}</Badge>
                    <Badge tone={item.isAvailable ? 'success' : 'muted'}>
                      {item.isAvailable ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>

                  {item.description ? (
                    <p className="line-clamp-2-safe text-xs leading-snug text-ink-500">
                      {item.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <PriceEditor item={item} />

                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={item.isAvailable ? 'outline' : 'secondary'}
                        loading={busyId === item.id}
                        onClick={() => toggleAvailability(item)}
                      >
                        {item.isAvailable ? 'Make Unavailable' : 'Make Available'}
                      </Button>

                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <ConfirmDialog
                        title={`Delete ${item.name}?`}
                        description={
                          <>
                            It will disappear from the customer menu right away. Orders that already
                            include it keep their original name and price, so your sales history
                            stays accurate.
                          </>
                        }
                        confirmLabel="Delete item"
                        destructive
                        onConfirm={() => remove(item)}
                        trigger={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete ${item.name}`}
                            className="text-ink-300 hover:bg-chili-50 hover:text-chili-600"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        categories={categories}
        defaultCategoryId={categoryFilter || undefined}
      />
    </div>
  )
}

/** Inline price editing — tap the price, type a new one, save. */
function PriceEditor({ item }: { item: MenuRow }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(String(centavosToPesos(item.price)))
  const [saving, setSaving] = React.useState(false)

  // Pick up the saved price once the server round-trip refreshes this row.
  const [renderedPrice, setRenderedPrice] = React.useState(item.price)
  if (renderedPrice !== item.price) {
    setRenderedPrice(item.price)
    setValue(String(centavosToPesos(item.price)))
  }

  async function save() {
    setSaving(true)
    try {
      const result = await updatePriceAction(item.id, value)
      if (result.ok) {
        toast.success(result.message ?? 'Price updated.')
        setEditing(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Could not update the price.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tabular rounded-lg px-2 py-1 text-base font-extrabold text-ink-900 transition-colors hover:bg-cream-100"
        aria-label={`Change price of ${item.name}, currently ${formatMoneyCompact(item.price)}`}
      >
        {formatMoneyCompact(item.price)}
        <span className="ml-1.5 text-xs font-medium text-ink-300">edit</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-bold text-ink-500">₱</span>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void save()
          }
          if (event.key === 'Escape') setEditing(false)
        }}
        type="number"
        step="0.01"
        min="0.01"
        autoFocus
        aria-label={`New price for ${item.name}`}
        className="w-24 px-2 py-1.5 text-sm"
      />
      <Button
        size="icon-sm"
        onClick={save}
        loading={saving}
        aria-label="Save price"
        className="shrink-0"
      >
        {saving ? null : <Check className="size-4" />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="shrink-0"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
