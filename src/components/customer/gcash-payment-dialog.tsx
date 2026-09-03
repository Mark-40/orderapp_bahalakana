'use client'

import * as React from 'react'
import Image from 'next/image'
import { Check, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { uploadReceiptAction } from '@/server/actions/receipts'

/**
 * Two-step GCash payment flow used from the checkout page:
 *  1. Show the shop's QR so the customer can pay from the GCash app.
 *  2. Ask them to attach a screenshot of the receipt.
 * Confirming is only enabled once the upload succeeds.
 */
export function GCashPaymentDialog({
  open,
  onOpenChange,
  amount,
  initialReceiptUrl,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: number
  initialReceiptUrl: string | null
  onConfirm: (receiptUrl: string) => void
}) {
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(initialReceiptUrl)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setReceiptUrl(initialReceiptUrl)
      setError(null)
    }
  }, [open, initialReceiptUrl])

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadReceiptAction(formData)
      if (result.ok) {
        setReceiptUrl(result.url)
        toast.success('Receipt attached')
      } else {
        setError(result.error)
      }
    } catch {
      setError('The upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void handleFile(file)
    // Reset so re-selecting the same file still fires the change event.
    event.target.value = ''
  }

  function handleConfirm() {
    if (!receiptUrl) return
    onConfirm(receiptUrl)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Pay with GCash"
        description={`Send ${formatMoney(amount)} to the shop, then attach your receipt.`}
      >
        <DialogBody className="space-y-4">
          <section>
            <h3 className="text-xs font-bold tracking-wide text-ink-500 uppercase">
              1. Scan this QR
            </h3>
            <div className="mt-2 rounded-2xl border border-cream-200 bg-white p-3">
              <div className="relative mx-auto aspect-square max-w-[240px]">
                <Image
                  src="/gcash-qr.svg"
                  alt="Shop GCash QR code"
                  fill
                  sizes="240px"
                  className="rounded-xl object-contain"
                  priority
                />
              </div>
              <p className="mt-3 text-center text-sm font-semibold text-ink-700">
                Amount to send:{' '}
                <span className="tabular text-brand-600">{formatMoney(amount)}</span>
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold tracking-wide text-ink-500 uppercase">
              2. Attach your receipt
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Screenshot or photo of the successful GCash transaction.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleChange}
            />

            {receiptUrl ? (
              <div className="mt-2 flex items-start gap-3 rounded-2xl border border-leaf-100 bg-leaf-100/40 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptUrl}
                  alt="Uploaded GCash receipt"
                  className="size-20 shrink-0 rounded-xl object-cover ring-1 ring-white"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-leaf-700">
                    <Check className="size-4" />
                    Receipt attached
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Ready to confirm your order.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-cream-200 hover:bg-cream-50 disabled:opacity-60"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptUrl(null)}
                      disabled={uploading}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-chili-600 ring-1 ring-cream-200 hover:bg-chili-50 disabled:opacity-60"
                    >
                      <X className="size-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  'mt-2 flex w-full min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 transition-colors',
                  uploading
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-cream-200 bg-white text-ink-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700',
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-6 animate-spin" />
                    <span className="text-sm font-semibold">Uploading receipt…</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-6" />
                    <span className="text-sm font-semibold">Tap to upload receipt</span>
                    <span className="text-xs">JPG, PNG or WebP · up to 5MB</span>
                  </>
                )}
              </button>
            )}

            {error ? (
              <p className="mt-2 text-xs font-semibold text-chili-600">{error}</p>
            ) : null}
          </section>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-24"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!receiptUrl || uploading}
            className="sm:min-w-40"
          >
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
