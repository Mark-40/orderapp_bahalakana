'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Renders a menu image from any source — a local `/uploads/...` path, a
 * Cloudinary URL, an S3/Spaces CDN URL — without Next.js needing a
 * `remotePatterns` entry per provider. That keeps image storage swappable
 * (see src/lib/storage) instead of baking one vendor into the build config.
 *
 * A missing or broken image degrades to a warm placeholder rather than the
 * browser's broken-image glyph.
 */
export function SmartImage({
  src,
  alt,
  className,
  fallbackEmoji = '🍽️',
  sizes,
}: {
  src?: string | null
  alt: string
  className?: string
  fallbackEmoji?: string
  sizes?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  // A new src (e.g. after an upload) should get a fresh chance to load. React's
  // recommended way to reset state on a prop change is to adjust it during
  // render rather than in an effect, which avoids a wasted second pass.
  const [renderedSrc, setRenderedSrc] = React.useState(src)
  if (renderedSrc !== src) {
    setRenderedSrc(src)
    setFailed(false)
    setLoaded(false)
  }

  if (!src || failed) {
    return (
      <div
        className={cn(
          'relative grid place-items-center overflow-hidden bg-brand-gradient-soft select-none',
          'ring-1 ring-inset ring-white/60',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-4 -right-3 size-16 rounded-full bg-white/40 blur-xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-5 -left-4 size-16 rounded-full bg-white/30 blur-xl"
        />
        <span aria-hidden className="relative text-[2.75rem] drop-shadow-sm">
          {fallbackEmoji}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden bg-cream-200', className)}>
      {!loaded ? <div className="absolute inset-0 animate-pulse bg-cream-200" aria-hidden /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'size-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
