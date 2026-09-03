import 'server-only'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { extensionFor, type PutFileInput, type StorageProvider, type StoredFile } from './types'

/**
 * S3-compatible storage (AWS S3, DigitalOcean Spaces, Cloudflare R2, MinIO)
 * using hand-rolled SigV4 so the app carries no AWS SDK dependency.
 */
export function createS3Storage(): StorageProvider {
  const bucket = requireEnv('S3_BUCKET')
  const region = process.env.S3_REGION || 'us-east-1'
  const accessKeyId = requireEnv('S3_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('S3_SECRET_ACCESS_KEY')
  const endpoint = (process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`).replace(/\/$/, '')
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'
  const publicBase = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '')

  function urlFor(key: string): { requestUrl: string; host: string; publicUrl: string } {
    const parsed = new URL(endpoint)
    const host = forcePathStyle ? parsed.host : `${bucket}.${parsed.host}`
    const pathname = forcePathStyle ? `/${bucket}/${key}` : `/${key}`
    const requestUrl = `${parsed.protocol}//${host}${pathname}`
    return { requestUrl, host, publicUrl: publicBase ? `${publicBase}/${key}` : requestUrl }
  }

  async function signedFetch(
    method: 'PUT' | 'DELETE',
    key: string,
    body: Buffer | undefined,
    contentType?: string,
  ) {
    const { requestUrl, host } = urlFor(key)
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const payloadHash = createHash('sha256')
      .update(body ?? Buffer.alloc(0))
      .digest('hex')

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    }
    if (contentType) headers['content-type'] = contentType
    if (method === 'PUT') headers['x-amz-acl'] = 'public-read'

    const signedHeaders = Object.keys(headers).sort()
    const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h]}\n`).join('')
    const signedHeaderList = signedHeaders.join(';')
    const canonicalUri = new URL(requestUrl).pathname
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')

    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaderList,
      payloadHash,
    ].join('\n')

    const scope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest()
    const kRegion = createHmac('sha256', kDate).update(region).digest()
    const kService = createHmac('sha256', kRegion).update('s3').digest()
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest()
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    return fetch(requestUrl, {
      method,
      headers: {
        ...headers,
        Authorization:
          `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
          `SignedHeaders=${signedHeaderList}, Signature=${signature}`,
      },
      body: body ? new Uint8Array(body) : undefined,
    })
  }

  return {
    name: 's3',

    async put({ buffer, filename, contentType }: PutFileInput): Promise<StoredFile> {
      const key = `menu/${randomUUID()}.${extensionFor(contentType, filename)}`
      const res = await signedFetch('PUT', key, buffer, contentType)
      if (!res.ok) throw new Error(`S3 upload failed (${res.status}): ${await res.text()}`)
      return { url: urlFor(key).publicUrl, key }
    },

    async delete(key: string): Promise<void> {
      await signedFetch('DELETE', key, undefined).catch(() => undefined)
    },
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3.`)
  return value
}
