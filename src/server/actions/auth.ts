'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { fakeVerify, hashPassword, verifyPassword } from '@/lib/auth/password'
import { destroySession, startSession } from '@/lib/auth/session'
import { requireAdminAction } from '@/lib/auth/guard'
import { check } from '@/lib/rate-limit'
import { changePasswordSchema, loginSchema } from '@/lib/validation/schemas'

export type ActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  message?: string
}/**
 * Credentials login.
 *
 * Failures are deliberately indistinguishable — a wrong email and a wrong
 * password produce the same message and comparable timing — so the form cannot
 * be used to enumerate admin accounts.
 */
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const email = parsed.data.email.toLowerCase()

  const limit = check(`login:${email}`, 8, 300)
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many attempts. Please wait ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s) and try again.`,
    }
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.isActive) {
    await fakeVerify()
    return { ok: false, error: 'Incorrect email or password.' }
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { ok: false, error: 'Incorrect email or password.' }
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role })

  // Only same-origin relative paths are honoured — never an absolute URL or
  // a protocol-relative '//evil.com', which would be an open redirect.
  const next = String(formData.get('next') ?? '')
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/admin'

  redirect(safeNext)
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/admin/login')
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminAction()

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) return { ok: false, error: 'Your account could not be found.' }

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { ok: false, fieldErrors: { currentPassword: ['That is not your current password.'] } }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  })

  return { ok: true, message: 'Password updated.' }
}
