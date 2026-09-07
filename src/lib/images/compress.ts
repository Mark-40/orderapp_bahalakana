/**
 * Client-side image downscaling, run before an upload leaves the browser.
 *
 * Why this exists: uploads go through a Server Action, and the host caps the
 * request body well below what a modern phone camera produces — Vercel rejects
 * anything over 4.5MB before Next.js or our own size check ever sees it, with
 * an opaque 413. A GCash receipt is a screenshot and a menu photo is a snack on
 * a plate, so neither needs 12 megapixels. Re-encoding in the browser keeps the
 * upload small, fast on mobile data, and cheap to store.
 *
 * The server still validates size and type: this is an optimisation, never a
 * security boundary. Every failure path falls back to the original file.
 */

/**
 * What the compressed file must fit inside. Deliberately well under Vercel's
 * 4.5MB body cap — the multipart envelope, the filename and the other form
 * fields all share that budget.
 */
export const UPLOAD_BUDGET_BYTES = 3 * 1024 * 1024

/** Longest edge of the re-encoded image, in pixels. Plenty for a receipt. */
const MAX_EDGE = 2200

/** Quality ladder, tried in order until the result fits the budget. */
const ATTEMPTS: { maxEdge: number; quality: number }[] = [
  { maxEdge: MAX_EDGE, quality: 0.82 },
  { maxEdge: 1600, quality: 0.75 },
  { maxEdge: 1200, quality: 0.65 },
]

/**
 * Animated images cannot survive a canvas round-trip — it would keep only the
 * first frame — so they are passed through untouched.
 */
const PASS_THROUGH_TYPES = new Set(['image/gif'])

export type CompressResult =
  | { ok: true; file: File; original: File; compressed: boolean }
  | { ok: false; reason: 'TOO_LARGE'; original: File }

/**
 * Shrinks `file` until it fits `UPLOAD_BUDGET_BYTES`.
 *
 * Returns the original untouched when it already fits, when the format must be
 * preserved, or when the browser cannot decode it. Returns `TOO_LARGE` only
 * when the file cannot be brought under budget — an animated GIF, or an image
 * the browser refused to decode, that is simply too big to send.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  if (file.size <= UPLOAD_BUDGET_BYTES) {
    return { ok: true, file, original: file, compressed: false }
  }

  if (PASS_THROUGH_TYPES.has(file.type)) {
    return { ok: false, reason: 'TOO_LARGE', original: file }
  }

  const bitmap = await decode(file)
  if (!bitmap) {
    // Undecodable and over budget: sending it would only earn a 413.
    return { ok: false, reason: 'TOO_LARGE', original: file }
  }

  try {
    for (const attempt of ATTEMPTS) {
      const blob = await render(bitmap, attempt.maxEdge, attempt.quality)
      if (blob && blob.size <= UPLOAD_BUDGET_BYTES) {
        // Never hand back something bigger than what we were given.
        if (blob.size >= file.size) {
          return { ok: true, file, original: file, compressed: false }
        }
        return {
          ok: true,
          file: new File([blob], renameToJpeg(file.name), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          }),
          original: file,
          compressed: true,
        }
      }
    }
    return { ok: false, reason: 'TOO_LARGE', original: file }
  } finally {
    bitmap.close?.()
  }
}

type Decoded = {
  width: number
  height: number
  source: CanvasImageSource
  close?: () => void
}

/**
 * Prefers createImageBitmap, falling back to an <img> for older Safari.
 *
 * Never throws. A null return means "cannot shrink this here", which the caller
 * reports as an honest size error — far better than an exception surfacing as
 * "the upload failed" when the real problem is a 20MP photo.
 */
async function decode(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        close: () => bitmap.close(),
      }
    } catch {
      // Fall through to the <img> path.
    }
  }

  // Guarded rather than assumed: this module is only ever imported by client
  // components, but a stray server-side import must not crash an upload.
  if (typeof Image !== 'function' || typeof URL.createObjectURL !== 'function') {
    return null
  }

  return new Promise<Decoded | null>((resolve) => {
    let url: string | null = null
    try {
      url = URL.createObjectURL(file)
      const image = new Image()
      const objectUrl = url
      image.onload = () =>
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
          source: image,
          close: () => URL.revokeObjectURL(objectUrl),
        })
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      }
      image.src = url
    } catch {
      if (url) URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

/** Never throws; null means this attempt produced nothing usable. */
async function render(
  decoded: Decoded,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null

  const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height))
  const width = Math.max(1, Math.round(decoded.width * scale))
  const height = Math.max(1, Math.round(decoded.height * scale))

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return null
    // A JPEG has no alpha channel, so anything transparent would go black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(decoded.source, 0, 0, width, height)

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
    })
  } catch {
    // A cross-origin or oversized canvas can throw on read-back.
    return null
  }
}

function renameToJpeg(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '') || 'upload'
  return `${base}.jpg`
}

/** "2.4MB" / "812KB" — for telling someone what just happened to their file. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}
