import type { MetadataRoute } from 'next'

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Bahala ka na'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${businessName} — Order online`,
    short_name: businessName,
    description: `Browse the menu and order breakfast, snacks and drinks from ${businessName}.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ef8a12',
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/icon1', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
