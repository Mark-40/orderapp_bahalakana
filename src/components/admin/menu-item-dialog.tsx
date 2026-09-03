'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { centavosToPesos } from '@/lib/money'
import {
  createMenuItemAction,
  updateMenuItemAction,
  type MutationResult,
} from '@/server/actions/menu'
import { ImageUploader } from './image-uploader'

export type MenuItemDraft = {
  id: string
  name: string
  description: string | null
  categoryId: string
  price: number
  imageUrl: string | null
  isAvailable: boolean
  sortOrder: number
}

export type CategoryOption = { id: string; name: string }

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} className="sm:w-40">
      {pending ? 'Saving' : label}
    </Button>
  )
}

/**
 * Add/edit form for a menu item. The same dialog handles both, since the field
 * set is identical and duplicating it would mean two places to keep in sync.
 */
export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  defaultCategoryId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: MenuItemDraft
  categories: CategoryOption[]
  defaultCategoryId?: string
}) {
  const router = useRouter()
  const editing = Boolean(item)
  const action = editing ? updateMenuItemAction : createMenuItemAction
  const [state, formAction] = useActionState<MutationResult, FormData>(action, { ok: false })

  // A completed save closes the dialog and refreshes the list.
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
        title={editing ? 'Edit item' : 'Add menu item'}
        description={editing ? item?.name : 'It will appear on the customer menu right away.'}
      >
        {/* key resets the uncontrolled fields when switching between items. */}
        <form action={formAction} key={item?.id ?? 'new'} className="flex min-h-0 flex-col">
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <input type="hidden" name="sortOrder" value={item?.sortOrder ?? 0} />

          <DialogBody className="space-y-4">
            <Field label="Name" htmlFor="name" required error={state.fieldErrors?.name?.[0]}>
              <Input
                id="name"
                name="name"
                defaultValue={item?.name}
                placeholder="Chicken Sandwich"
                maxLength={80}
                autoFocus={!editing}
                invalid={Boolean(state.fieldErrors?.name)}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              error={state.fieldErrors?.description?.[0]}
              hint="One short line shown under the name."
            >
              <Textarea
                id="description"
                name="description"
                defaultValue={item?.description ?? ''}
                placeholder="Grilled chicken sandwich with lettuce and cheese."
                maxLength={300}
                className="min-h-20"
                invalid={Boolean(state.fieldErrors?.description)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Category"
                htmlFor="categoryId"
                required
                error={state.fieldErrors?.categoryId?.[0]}
              >
                <Select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={item?.categoryId ?? defaultCategoryId ?? categories[0]?.id}
                  invalid={Boolean(state.fieldErrors?.categoryId)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Price (₱)"
                htmlFor="price"
                required
                error={state.fieldErrors?.price?.[0]}
              >
                <Input
                  id="price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  defaultValue={item ? centavosToPesos(item.price) : ''}
                  placeholder="120"
                  invalid={Boolean(state.fieldErrors?.price)}
                />
              </Field>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-ink-700">Photo</p>
              <ImageUploader name="imageUrl" defaultValue={item?.imageUrl} itemName={item?.name} />
              {state.fieldErrors?.imageUrl?.[0] ? (
                <p role="alert" className="text-sm font-medium text-chili-600">
                  {state.fieldErrors.imageUrl[0]}
                </p>
              ) : null}
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-cream-200 bg-white px-3.5 py-3">
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  Available to order
                </span>
                <span className="block text-xs text-ink-500">
                  Turn off to show it as sold out.
                </span>
              </span>
              <input
                type="checkbox"
                name="isAvailable"
                defaultChecked={item?.isAvailable ?? true}
                className="size-6 shrink-0 accent-brand-500"
              />
            </label>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton label={editing ? 'Save changes' : 'Add item'} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
