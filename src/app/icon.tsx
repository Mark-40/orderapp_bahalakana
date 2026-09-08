import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Bahala ka na'

export default function Icon() {
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
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        {letter}
      </div>
    ),
    { ...size },
  )
}
