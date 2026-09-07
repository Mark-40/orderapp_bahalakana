import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

/**
 * A single PrismaClient per process. Next.js dev-mode module reloading would
 * otherwise open a new connection pool on every edit until Postgres refuses.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * Connections per instance. On a serverless host every warm instance keeps its
 * own pool, and a function handles one request at a time, so a large pool just
 * hoards connections the pooler could give to another instance — Supabase's
 * session-mode pooler only has 15 client slots in total, and exhausting them
 * fails every query with EMAXCONNSESSION. A long-running server benefits from
 * a few more. Override with DATABASE_POOL_MAX.
 */
function poolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX)
  if (Number.isInteger(configured) && configured > 0) return configured
  // VERCEL is set on every Vercel runtime and build.
  return process.env.VERCEL ? 1 : 5
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: poolMax() }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
