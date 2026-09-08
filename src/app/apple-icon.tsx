import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Bahala ka na'

export default function AppleIcon() {
  const letter = businessName.trim().charAt(0).toUpperCase() || 'B'
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ef8a12',
          color: '#ffffff',
          fontSize: 112,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        {letter}
      </div>
    ),
    { ...size },
  )
}
