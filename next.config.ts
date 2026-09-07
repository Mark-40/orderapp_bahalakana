import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image hosts are intentionally not hard-coded to one provider (see src/lib/storage).
  // The app renders menu images through <SmartImage>, a plain <img> with a graceful
  // fallback, so swapping Local -> Cloudinary -> S3 needs no Next.js config change.
  experimental: {
    // Must stay above MAX_IMAGE_BYTES (src/lib/storage/types.ts): uploads go
    // through a Server Action, and a body over this limit is rejected by the
    // framework before the action's own size check can report a friendly error.
    // The headroom covers multipart encoding overhead.
    serverActions: { bodySizeLimit: '28mb' },
  },
}

export default nextConfig
