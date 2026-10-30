import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import StoreBootstrap from '@/components/StoreBootstrap'

export const metadata: Metadata = {
  title: 'Oversight Arena',
  description:
    'A benchmark for scalable oversight: three worker agents submit code patches, a small overseer model learns to catch the ones hiding vulnerabilities.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <StoreBootstrap />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
