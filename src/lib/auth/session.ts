import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

/**
 * Session handling.
 *
 * We issue a signed (HS256) JWT stored in an HttpOnly, SameSite=Lax, Secure
 * cookie. SameSite=Lax plus Next.js's built-in Server Action origin checking
 * covers CSRF for the admin mutations; the token is never readable from
 * JavaScript, and nothing about it is exposed to the client bundle.
 */

export const SESSION_COOKIE = 'orderapp_session'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STAFF'
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'AUTH_SECRET is missing or shorter than 32 characters. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    )
  }
  return new TextEncoder().encode(secret)
}

function maxAgeSeconds(): number {
  const parsed = Number(process.env.SESSION_MAX_AGE_SECONDS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 8
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSeconds())
    .sign(secretKey())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (!payload.sub || typeof payload.email !== 'string') return null
    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : payload.email,
      role: payload.role === 'STAFF' ? 'STAFF' : 'ADMIN',
    }
  } catch {
    return null
  }
}

export async function startSession(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds(),
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/** Reads and cryptographically verifies the current session, if any. */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}
