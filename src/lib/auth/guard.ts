import 'server-only'
import { redirect } from 'next/navigation'
import { getSession, type SessionUser } from './session'

/**
 * Server-side authorization gate. The middleware gives a fast redirect for page
 * navigations, but every admin page and every mutating Server Action calls this
 * too — middleware alone is not an authorization boundary.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) redirect('/admin/login')
  return user
}

export class UnauthorizedError extends Error {
  constructor(message = 'You must be signed in to do that.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/** Same check for Server Actions, where throwing beats redirecting. */
export async function requireAdminAction(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new UnauthorizedError()
  return user
}
