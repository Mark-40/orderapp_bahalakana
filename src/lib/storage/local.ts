import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { extensionFor, type PutFileInput, type StorageProvider, type StoredFile } from './types'

/**
 * Writes into `public/uploads` and serves from `/uploads`. Perfect for local
 * development and single-box deployments; on ephemeral hosts (Vercel, Fly
 * machines without a volume) switch STORAGE_DRIVER to cloudinary or s3.
 */
export function createLocalStorage(): StorageProvider {
  const dir = process.env.LOCAL_UPLOAD_DIR || 'public/uploads'
  const prefix = process.env.LOCAL_PUBLIC_PREFIX || '/uploads'
  // turbopackIgnore: the upload directory is deliberately env-configurable, so
  // the bundler cannot resolve it statically. Without this opt-out Turbopack
  // traces the entire project into the server output.
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), dir)

  return {
    name: 'local',

    async put({ buffer, filename, contentType }: PutFileInput): Promise<StoredFile> {
      await mkdir(root, { recursive: true })
      const name = `${randomUUID()}.${extensionFor(contentType, filename)}`
      await writeFile(path.join(/* turbopackIgnore: true */ root, name), buffer)
      return { url: `${prefix}/${name}`, key: name }
    },

    async delete(key: string): Promise<void> {
      // Guard against traversal — `key` should only ever be a bare filename.
      const safe = path.basename(key)
      if (!safe || safe !== key) return
      await unlink(path.join(/* turbopackIgnore: true */ root, safe)).catch(() => undefined)
    },
  }
}
