import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image hosts are intentionally not hard-coded to one provider (see src/lib/storage).
  // The app renders menu images through <SmartImage>, a plain <img> with a graceful
  // fallback, so swapping Local -> Cloudinary -> S3 needs no Next.js config change.
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },
}

export default nextConfig
