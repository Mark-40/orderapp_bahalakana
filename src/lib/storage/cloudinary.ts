import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import type { PutFileInput, StorageProvider, StoredFile } from './types'

/**
 * Cloudinary via its signed REST upload endpoint — no SDK dependency.
 */
export function createCloudinaryStorage(): StorageProvider {
  const cloudName = requireEnv('CLOUDINARY_CLOUD_NAME')
  const apiKey = requireEnv('CLOUDINARY_API_KEY')
  const apiSecret = requireEnv('CLOUDINARY_API_SECRET')
  const folder = process.env.CLOUDINARY_FOLDER || 'orderapp'

  function sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&')
    return createHash('sha1').update(toSign + apiSecret).digest('hex')
  }

  return {
    name: 'cloudinary',

    async put({ buffer, contentType }: PutFileInput): Promise<StoredFile> {
      const timestamp = String(Math.floor(Date.now() / 1000))
      const publicId = `${folder}/${randomUUID()}`
      const signature = sign({ public_id: publicId, timestamp })

      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(buffer)], { type: contentType }))
      form.append('api_key', apiKey)
      form.append('timestamp', timestamp)
      form.append('public_id', publicId)
      form.append('signature', signature)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        throw new Error(`Cloudinary upload failed (${res.status}): ${await res.text()}`)
      }
      const json = (await res.json()) as { secure_url: string; public_id: string }
      return { url: json.secure_url, key: json.public_id }
    },

    async delete(key: string): Promise<void> {
      const timestamp = String(Math.floor(Date.now() / 1000))
      const signature = sign({ public_id: key, timestamp })
      const form = new FormData()
      form.append('public_id', key)
      form.append('api_key', apiKey)
      form.append('timestamp', timestamp)
      form.append('signature', signature)
      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: 'POST',
        body: form,
      }).catch(() => undefined)
    },
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=cloudinary.`)
  return value
}
