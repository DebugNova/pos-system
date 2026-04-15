import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { InstallPrompt } from '@/components/pos/install-prompt'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: 'swap' });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: 'swap' });

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'SUHASHI POS | Modern and Advance POS System',
  description: 'Touch-first Cafe Point-of-Sale System',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SUHASHI POS | Modern and Advance POS System',
  },
  icons: {
    icon: [
      {
        url: '/favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/favicon-16.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
    apple: '/apple-icon-cat.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased safe-top safe-x`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
          <Toaster position="bottom-right" />
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  )
}
