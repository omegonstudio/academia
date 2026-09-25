import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeGate } from '@/components/ui/primitives'

const themeBootstrap = `(() => {
  try {
    const key = 'academy-theme'
    const saved = localStorage.getItem(key)
    const mode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
    const root = document.documentElement
    root.classList.toggle('light', !isDark)
    root.classList.toggle('dark', isDark)
  } catch {}
})()`

export const metadata: Metadata = {
  title: 'Academia de Español — Omegon',
  description: 'Aprendé español para comunicarte de verdad. Clases individuales, grupales y formación docente.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <ThemeGate>{children}</ThemeGate>
      </body>
    </html>
  )
}
