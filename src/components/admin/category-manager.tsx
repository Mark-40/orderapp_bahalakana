'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/states'
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  updateCategoryAction,
} from '@/server/actions/categories'
import type { MutationResult } from '@/server/actions/menu'

export type CategoryRow = {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  itemCount: number
}

/**
 * Category management. Order matters — it is the order customers see on the
 * menu — so reordering is a first-class action rather than a hidden number.
 */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CategoryRow | undefined>(undefined)
  const [movingId, setMovingId] = React.useState<string | null>(null)

  async function move(id: string, direction: 'up' | 'down') {
    setMovingId(id)
    try {
      const result = await moveCategoryAction(id, direction)
      if (result.ok) router.refresh()
      else toast.error(result.error ?? 'Could not reorder.')
    } finally {
      setMovingId(null)
    }
  }

  async function remove(category: CategoryRow) {
    const result = await deleteCategoryAction(category.id)
    if (result.ok) {
      toast.success(result.message ?? 'Deleted.')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Could not delete that category.')
    }
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setEditing(undefined)
          setDialogOpen(true)
        }}
        className="sm:w-44"
      >
        <Plus className="size-4" />
        Add category
      </Button>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Tags className="size-6" />}
          title="No categories yet"
          description="Categories group your menu — Breakfast, Snacks, Drinks. Add one to get started."
        />
      ) : (
        <ul className="space-y-2">
          {categories.map((category, index) => (
            <li
              key={category.id}
              className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-white p-3 shadow-[var(--shadow-soft)]"
            >
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  disabled={index === 0 || movingId !== null}
                  onClick={() => move(category.id, 'up')}
                  aria-label={`Move ${category.name} up`}
                  className="grid size-7 place-items-center rounded-md text-ink-300 transition-colors hover:bg-cream-100 hover:text-ink-700 disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={index === categories.length - 1 || movingId !== null}
                  onClick={() => move(category.id, 'down')}
                  aria-label={`Move ${category.name} down`}
                  className="grid size-7 place-items-center rounded-md text-ink-300 transition-colors hover:bg-cream-100 hover:text-ink-700 disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-ink-900">{category.name}</p>
                  {!category.isActive ? <Badge tone="muted">Hidden</Badge> : null}
                </div>
                {category.description ? (
                  <p className="mt-0.5 truncate text-xs text-ink-500">{category.description}</p>
                ) : null}
                <p className="tabular mt-0.5 text-xs text-ink-300">
                  {category.itemCount} item{category.itemCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => {
                    setEditing(category)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>

                <ConfirmDialog
                  title={`Delete ${category.name}?`}
                  description={
                    category.itemCount > 0
                      ? `${category.name} still holds ${category.itemCount} menu item(s). Move or delete those first.`
                      : 'This category will be removed from the customer menu.'
                  }
                  confirmLabel="Delete category"
                  destructive
                  onConfirm={() => remove(category)}
                  trigger={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${category.name}`}
                      className="text-ink-300 hover:bg-chili-50 hover:text-chili-600"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} />
    </div>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} className="sm:w-40">
      {pending ? 'Saving' : label}
    </Button>
  )
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: CategoryRow
}) {
  const router = useRouter()
  const editing = Boolean(category)
  const action = editing ? updateCategoryAction : createCategoryAction
  const [state, formAction] = useActionState<MutationResult, FormData>(action, { ok: false })

  const handled = React.useRef<MutationResult | null>(null)
  React.useEffect(() => {
    if (!state.ok || handled.current === state) return
    handled.current = state
    toast.success(state.message ?? 'Saved.')
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  React.useEffect(() => {
    if (!state.ok && state.error) toast.error(state.error)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? 'Edit category' : 'Add category'}
        description={editing ? category?.name : 'Groups items on the customer menu.'}
      >
        <form action={formAction} key={category?.id ?? 'new'} className="flex min-h-0 flex-col">
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <input type="hidden" name="sortOrder" value={category?.sortOrder ?? 0} />

          <DialogBody className="space-y-4">
            <Field label="Name" htmlFor="category-name" required error={state.fieldErrors?.name?.[0]}>
              <Input
                id="category-name"
                name="name"
                defaultValue={category?.name}
                placeholder="Breakfast"
                maxLength={50}
                autoFocus
                invalid={Boolean(state.fieldErrors?.name)}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="category-description"
              error={state.fieldErrors?.description?.[0]}
              hint="Shown under the category heading on the menu."
            >
              <Textarea
                id="category-description"
                name="description"
                defaultValue={category?.description ?? ''}
                placeholder="Start the day right"
                maxLength={200}
                className="min-h-16"
                invalid={Boolean(state.fieldErrors?.description)}
              />
            </Field>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-cream-200 bg-white px-3.5 py-3">
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  Show on the customer menu
                </span>
                <span className="block text-xs text-ink-500">
                  Turn off to hide the whole category and its items.
                </span>
              </span>
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={category?.isActive ?? true}
                className="size-6 shrink-0 accent-brand-500"
              />
            </label>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton label={editing ? 'Save changes' : 'Add category'} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
