import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Bahala ka na'

export const metadata: Metadata = {
  title: {
    default: `${businessName} — Order online`,
    template: `%s · ${businessName}`,
  },
  description: `Browse the menu and order breakfast, snacks and drinks from ${businessName}.`,
  applicationName: businessName,
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#ef8a12',
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays enabled: disabling it is an accessibility regression.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ className: 'rounded-xl text-sm' }}
        />
      </body>
    </html>
  )
}
