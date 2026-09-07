export type StoredFile = {
  /** Public URL the browser can render. */
  url: string
  /** Provider-specific handle used for deletion (path, public_id, key). */
  key: string
}

export type PutFileInput = {
  buffer: Buffer
  /** Original filename, used only to derive an extension. */
  filename: string
  contentType: string
}

/**
 * The one interface the application knows about. Adding DigitalOcean Spaces,
 * R2, Supabase Storage, etc. means writing another implementation of this —
 * no page, component, or action changes.
 */
export interface StorageProvider {
  readonly name: string
  put(input: PutFileInput): Promise<StoredFile>
  delete(key: string): Promise<void>
}

/**
 * Upload ceiling for menu photos and GCash receipts. Keep MAX_IMAGE_LABEL in
 * step with it, and keep next.config.ts's serverActions.bodySizeLimit above it
 * — the multipart body has to fit through the Server Action before this check
 * ever runs.
 */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024

/** How the ceiling is spelled out to people, in UI copy and error messages. */
export const MAX_IMAGE_LABEL = '25MB'

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const

export function extensionFor(contentType: string, filename: string): string {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
  }
  const known = byType[contentType]
  if (known) return known
  const fromName = filename.split('.').pop()?.toLowerCase()
  return fromName && /^[a-z0-9]{2,5}$/.test(fromName) ? fromName : 'bin'
}
