'use server'

import { headers } from 'next/headers'
import { orderRateLimit } from '@/lib/rate-limit'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_LABEL, storage } from '@/lib/storage'
import { GCASH_ENABLED } from '@/lib/validation/schemas'

export type UploadReceiptResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

/**
 * Public endpoint used by the customer checkout to attach a GCash payment
 * receipt image before the order is submitted. Rate-limited by IP with the
 * same bucket as order submission, so a bad actor can't spam the uploads
 * folder ahead of a burst of orders.
 */
export async function uploadReceiptAction(formData: FormData): Promise<UploadReceiptResult> {
  // Closed along with the payment method it serves. This is a public,
  // unauthenticated write, so it should not stay reachable while unused.
  if (!GCASH_ENABLED) {
    return { ok: false, error: 'GCash is temporarily unavailable. Please choose Cash on delivery.' }
  }

  const headerList = await headers()
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    'unknown'

  const limit = orderRateLimit(ip)
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many upload attempts. Please wait about ${Math.ceil(
        limit.retryAfterSeconds / 60,
      )} minute(s) before trying again.`,
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a receipt image first.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `That image is larger than ${MAX_IMAGE_LABEL}. Please pick a smaller one.`,
    }
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Only JPEG, PNG, WebP, AVIF or GIF images are supported.' }
  }

  try {
    const stored = await storage().put({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      contentType: file.type,
    })
    return { ok: true, url: stored.url }
  } catch (error) {
    console.error('[uploadReceiptAction]', error)
    return { ok: false, error: 'The upload failed. Please try again.' }
  }
}
