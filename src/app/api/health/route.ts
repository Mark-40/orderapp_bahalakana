import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Liveness probe for deployment platforms — checks the DB is actually reachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', database: 'up' })
  } catch {
    return NextResponse.json({ status: 'degraded', database: 'down' }, { status: 503 })
  }
}
