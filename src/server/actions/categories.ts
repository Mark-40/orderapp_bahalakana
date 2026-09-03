'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdminAction } from '@/lib/auth/guard'
import { categorySchema } from '@/lib/validation/schemas'
import { slugify } from '@/lib/utils'
import type { MutationResult } from './menu'

function refresh() {
  revalidatePath('/')
  revalidatePath('/admin/categories')
  revalidatePath('/admin/menu')
}

function toInput(formData: FormData) {
  return {
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    sortOrder: formData.get('sortOrder') ?? 0,
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  }
}

/** Ensures the derived slug stays unique without surfacing it in the UI. */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || 'category'
  let candidate = base
  for (let suffix = 2; suffix < 100; suffix++) {
    const clash = await prisma.category.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    })
    if (!clash) return candidate
    candidate = `${base}-${suffix}`
  }
  return `${base}-${Date.now()}`
}

export async function createCategoryAction(
  _prev: MutationResult,
  formData: FormData,
): Promise<MutationResult> {
  await requireAdminAction()

  const parsed = categorySchema.safeParse(toInput(formData))
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const duplicate = await prisma.category.findFirst({
    where: { name: parsed.data.name },
    select: { id: true },
  })
  if (duplicate) return { ok: false, fieldErrors: { name: ['That category already exists.'] } }

  // Default to the end of the list when no explicit position is given.
  const sortOrder =
    parsed.data.sortOrder > 0
      ? parsed.data.sortOrder
      : ((await prisma.category.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1

  const created = await prisma.category.create({
    data: {
      name: parsed.data.name,
      slug: await uniqueSlug(parsed.data.name),
      description: parsed.data.description || null,
      sortOrder,
      isActive: parsed.data.isActive,
    },
    select: { id: true },
  })

  refresh()
  return { ok: true, id: created.id, message: `${parsed.data.name} created.` }
}

export async function updateCategoryAction(
  _prev: MutationResult,
  formData: FormData,
): Promise<MutationResult> {
  await requireAdminAction()

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, error: 'Missing category id.' }

  const parsed = categorySchema.safeParse(toInput(formData))
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'That category no longer exists.' }

  const duplicate = await prisma.category.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
    select: { id: true },
  })
  if (duplicate) return { ok: false, fieldErrors: { name: ['That category already exists.'] } }

  await prisma.category.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: existing.name === parsed.data.name ? existing.slug : await uniqueSlug(parsed.data.name, id),
      description: parsed.data.description || null,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
  })

  refresh()
  return { ok: true, id, message: `${parsed.data.name} updated.` }
}

/**
 * Deleting a category is blocked while it still holds menu items — the
 * alternative would either orphan them or cascade into a surprise bulk delete.
 */
export async function deleteCategoryAction(id: string): Promise<MutationResult> {
  await requireAdminAction()

  const category = await prisma.category.findUnique({
    where: { id },
    select: { name: true, _count: { select: { menuItems: true } } },
  })
  if (!category) return { ok: false, error: 'That category no longer exists.' }

  if (category._count.menuItems > 0) {
    return {
      ok: false,
      error: `${category.name} still has ${category._count.menuItems} menu item(s). Move or delete them first.`,
    }
  }

  await prisma.category.delete({ where: { id } })

  refresh()
  return { ok: true, message: `${category.name} deleted.` }
}

/** Reorder via the up/down controls on the categories page. */
export async function moveCategoryAction(
  id: string,
  direction: 'up' | 'down',
): Promise<MutationResult> {
  await requireAdminAction()

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true },
  })

  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) return { ok: false, error: 'That category no longer exists.' }

  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= categories.length) return { ok: true }

  const reordered = [...categories]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved!)

  // Rewrite the whole sequence so positions stay dense and predictable.
  await prisma.$transaction(
    reordered.map((category, position) =>
      prisma.category.update({ where: { id: category.id }, data: { sortOrder: position + 1 } }),
    ),
  )

  refresh()
  return { ok: true }
}
