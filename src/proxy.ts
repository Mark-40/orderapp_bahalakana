import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'

/**
 * Fast redirect for unauthenticated admin navigations (Next.js 16 proxy).
 *
 * This is a convenience layer, NOT the authorization boundary — it only checks
 * that a session cookie is present, because verifying the signature needs the
 * secret. Every admin page calls `requireAdmin()` and every admin Server Action
 * calls `requireAdminAction()`, which do the real cryptographic check.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const isLoginPage = pathname === '/admin/login'
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  if (!hasSessionCookie && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = ''
    // Remember where they were headed so login can send them back.
    if (pathname !== '/admin') url.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  if (hasSessionCookie && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
