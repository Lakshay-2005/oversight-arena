import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import StoreBootstrap from '@/components/StoreBootstrap'

export const metadata: Metadata = {
  title: 'Oversight Arena — AI Safety Benchmark',
  description: 'Multi-agent scalable oversight benchmark for AI safety research',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <ThemeProvider>
          <StoreBootstrap />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}