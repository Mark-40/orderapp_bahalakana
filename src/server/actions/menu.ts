'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdminAction } from '@/lib/auth/guard'
import { menuItemSchema, priceUpdateSchema } from '@/lib/validation/schemas'
import { storage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_LABEL } from '@/lib/storage'

export type MutationResult = {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string[]>
  /** Populated by createMenuItem/updateMenuItem so the client can react. */
  id?: string
}

function refresh() {
  revalidatePath('/')
  revalidatePath('/admin/menu')
  revalidatePath('/admin')
}

function toInput(formData: FormData) {
  return {
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    categoryId: formData.get('categoryId'),
    price: formData.get('price'),
    imageUrl: formData.get('imageUrl') ?? '',
    isAvailable: formData.get('isAvailable') === 'on' || formData.get('isAvailable') === 'true',
    sortOrder: formData.get('sortOrder') ?? 0,
  }
}

export async function createMenuItemAction(
  _prev: MutationResult,
  formData: FormData,
): Promise<MutationResult> {
  await requireAdminAction()

  const parsed = menuItemSchema.safeParse(toInput(formData))
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } })
  if (!category) return { ok: false, fieldErrors: { categoryId: ['That category no longer exists.'] } }

  const duplicate = await prisma.menuItem.findFirst({
    where: { categoryId: parsed.data.categoryId, name: parsed.data.name },
    select: { id: true },
  })
  if (duplicate) {
    return { ok: false, fieldErrors: { name: ['An item with this name already exists in that category.'] } }
  }

  const created = await prisma.menuItem.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      categoryId: parsed.data.categoryId,
      price: parsed.data.price,
      imageUrl: parsed.data.imageUrl || null,
      isAvailable: parsed.data.isAvailable,
      sortOrder: parsed.data.sortOrder,
    },
    select: { id: true },
  })

  refresh()
  return { ok: true, id: created.id, message: `${parsed.data.name} added to the menu.` }
}

export async function updateMenuItemAction(
  _prev: MutationResult,
  formData: FormData,
): Promise<MutationResult> {
  await requireAdminAction()

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, error: 'Missing item id.' }

  const parsed = menuItemSchema.safeParse(toInput(formData))
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const existing = await prisma.menuItem.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'That item no longer exists.' }

  const duplicate = await prisma.menuItem.findFirst({
    where: { categoryId: parsed.data.categoryId, name: parsed.data.name, NOT: { id } },
    select: { id: true },
  })
  if (duplicate) {
    return { ok: false, fieldErrors: { name: ['An item with this name already exists in that category.'] } }
  }

  await prisma.menuItem.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      categoryId: parsed.data.categoryId,
      price: parsed.data.price,
      imageUrl: parsed.data.imageUrl || null,
      isAvailable: parsed.data.isAvailable,
      sortOrder: parsed.data.sortOrder,
    },
  })

  // NOTE: existing OrderItems keep their own frozen name and price, so this
  // edit cannot alter the value of any order already placed.
  refresh()
  return { ok: true, id, message: `${parsed.data.name} updated.` }
}

/** Fast toggle used by the switch on each menu row. */
export async function setAvailabilityAction(
  id: string,
  isAvailable: boolean,
): Promise<MutationResult> {
  await requireAdminAction()

  const item = await prisma.menuItem
    .update({ where: { id }, data: { isAvailable }, select: { name: true } })
    .catch(() => null)

  if (!item) return { ok: false, error: 'That item no longer exists.' }

  refresh()
  return {
    ok: true,
    message: `${item.name} is now ${isAvailable ? 'available' : 'unavailable'}.`,
  }
}

/** Inline price editing from the menu list. */
export async function updatePriceAction(id: string, price: unknown): Promise<MutationResult> {
  await requireAdminAction()

  const parsed = priceUpdateSchema.safeParse({ id, price })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Enter a valid price.'
    return { ok: false, error: message }
  }

  const item = await prisma.menuItem
    .update({ where: { id }, data: { price: parsed.data.price }, select: { name: true } })
    .catch(() => null)

  if (!item) return { ok: false, error: 'That item no longer exists.' }

  refresh()
  return { ok: true, message: `${item.name} price updated.` }
}

/**
 * Deletes a menu item. Its OrderItem rows survive with `menuItemId` set to
 * NULL (see the schema's onDelete: SetNull) and keep the product name and
 * price they were created with, so historical orders stay intact.
 */
export async function deleteMenuItemAction(id: string): Promise<MutationResult> {
  await requireAdminAction()

  const item = await prisma.menuItem.findUnique({ where: { id }, select: { name: true } })
  if (!item) return { ok: false, error: 'That item no longer exists.' }

  await prisma.menuItem.delete({ where: { id } })

  refresh()
  return { ok: true, message: `${item.name} deleted. Past orders are unchanged.` }
}

/** Uploads an image through whichever storage driver is configured. */
export async function uploadImageAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdminAction()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image file first.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `That image is larger than ${MAX_IMAGE_LABEL}. Please pick a smaller one.`,
    }
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Only JPEG, PNG, WebP, AVIF or GIF images are supported.' }
  }

  try {
    const stored = await storage().put({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      contentType: file.type,
    })
    return { ok: true, url: stored.url }
  } catch (error) {
    console.error('[uploadImageAction]', error)
    return { ok: false, error: 'The upload failed. Please try again, or paste an image URL instead.' }
  }
}
