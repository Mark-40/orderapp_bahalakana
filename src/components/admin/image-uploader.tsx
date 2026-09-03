'use client'

import * as React from 'react'
import { ImagePlus, Link2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/field'
import { SmartImage } from '@/components/ui/smart-image'
import { cn } from '@/lib/utils'
import { uploadImageAction } from '@/server/actions/menu'

/**
 * Image picker for menu items. Uploading goes through the configured storage
 * driver; pasting a URL is offered as an escape hatch so the shop can use an
 * image they already host without any provider being set up.
 */
export function ImageUploader({
  name,
  defaultValue,
  itemName,
}: {
  name: string
  defaultValue?: string | null
  itemName?: string
}) {
  const [url, setUrl] = React.useState(defaultValue ?? '')
  const [uploading, setUploading] = React.useState(false)
  const [mode, setMode] = React.useState<'upload' | 'url'>('upload')
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadImageAction(formData)
      if (result.ok) {
        setUrl(result.url)
        toast.success('Image uploaded.')
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('The upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {/* The form only ever submits the resulting URL string. */}
      <input type="hidden" name={name} value={url} />

      <div className="flex gap-3">
        <SmartImage
          src={url || null}
          alt={itemName ? `${itemName} photo` : 'Menu item photo'}
          className="size-20 shrink-0 rounded-xl border border-cream-200"
        />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="flex gap-1.5">
            <ModeButton active={mode === 'upload'} onClick={() => setMode('upload')}>
              <ImagePlus className="size-3.5" />
              Upload
            </ModeButton>
            <ModeButton active={mode === 'url'} onClick={() => setMode('url')}>
              <Link2 className="size-3.5" />
              Paste URL
            </ModeButton>
            {url ? (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="ml-auto grid size-8 place-items-center rounded-lg text-ink-300 transition-colors hover:bg-chili-50 hover:text-chili-600"
                aria-label="Remove image"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {mode === 'upload' ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                className="sr-only"
                id={`${name}-file`}
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <label
                htmlFor={`${name}-file`}
                className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cream-200 bg-white px-3 text-xs font-semibold text-ink-500 transition-colors hover:border-brand-200 hover:text-brand-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>Choose an image (max 5MB)</>
                )}
              </label>
            </>
          ) : (
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/photo.jpg"
              inputMode="url"
              className="py-2 text-sm"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
        active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-cream-100',
      )}
    >
      {children}
    </button>
  )
}
