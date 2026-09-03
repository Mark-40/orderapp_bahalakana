import 'server-only'

/**
 * Small fixed-window limiter for public order submission.
 *
 * In-process on purpose: it needs no infrastructure and is enough to stop a
 * single client hammering checkout. Behind more than one instance, swap the
 * body for Redis/Upstash — the `check()` signature is what callers depend on.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

export function check(key: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return { ok: true, remaining: max - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  return {
    ok: existing.count <= max,
    remaining: Math.max(0, max - existing.count),
    retryAfterSeconds,
  }
}

export function orderRateLimit(key: string): RateLimitResult {
  const max = Number(process.env.ORDER_RATE_LIMIT_MAX) || 8
  const windowSeconds = Number(process.env.ORDER_RATE_LIMIT_WINDOW_SECONDS) || 600
  return check(`order:${key}`, max, windowSeconds)
}
