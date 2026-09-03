import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 no longer auto-loads .env, and the Prisma CLI runs outside Next.js.
// Node 24's built-in loader keeps this dependency-free.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'))
} catch {
  // .env is optional — CI/production inject real environment variables.
}

/**
 * Prisma 7 keeps the connection URL out of schema.prisma. The CLI reads it from
 * here; the runtime client gets it through the pg driver adapter (src/lib/db.ts).
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
