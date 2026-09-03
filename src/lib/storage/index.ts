import 'server-only'
import { createCloudinaryStorage } from './cloudinary'
import { createLocalStorage } from './local'
import { createS3Storage } from './s3'
import type { StorageProvider } from './types'

export * from './types'

let cached: StorageProvider | null = null

/**
 * Resolves the configured provider once per process. Application code depends
 * only on `StorageProvider`, so changing STORAGE_DRIVER is a deploy-time
 * decision rather than a code change.
 */
export function storage(): StorageProvider {
  if (cached) return cached
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase()

  switch (driver) {
    case 'cloudinary':
      cached = createCloudinaryStorage()
      break
    case 's3':
    case 'spaces':
    case 'r2':
      cached = createS3Storage()
      break
    case 'local':
      cached = createLocalStorage()
      break
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use local, cloudinary, or s3.`)
  }
  return cached
}
