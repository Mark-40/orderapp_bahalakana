'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdminAction } from '@/lib/auth/guard'
import { updateOrderStatusSchema } from '@/lib/validation/schemas'
import type { MutationResult } from './menu'

export async function updateOrderStatusAction(
  orderId: string,
  status: string,
): Promise<MutationResult> {
  await requireAdminAction()

  const parsed = updateOrderStatusSchema.safeParse({ orderId, status })
  if (!parsed.success) return { ok: false, error: 'That is not a valid order status.' }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { status: true, orderNumber: true },
  })
  if (!order) return { ok: false, error: 'That order no longer exists.' }
  if (order.status === parsed.data.status) return { ok: true }

  const now = new Date()
  await prisma.order.update({
    where: { id: parsed.data.orderId },
    data: {
      status: parsed.data.status,
      // Timestamps are set on the way in and cleared if the status moves back,
      // so reporting always reflects the current state.
      completedAt: parsed.data.status === 'COMPLETED' ? now : null,
      cancelledAt: parsed.data.status === 'CANCELLED' ? now : null,
    },
  })

  revalidatePath('/admin')
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${parsed.data.orderId}`)

  return { ok: true, message: `${order.orderNumber} is now ${parsed.data.status.toLowerCase()}.` }
}
