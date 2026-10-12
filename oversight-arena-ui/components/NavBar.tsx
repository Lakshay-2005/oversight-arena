'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useArenaStore } from '@/store/arenaStore'
import { useTheme } from '@/context/ThemeContext'
import { DIFFICULTY_PRESETS, DifficultyPreset } from '@/types'
import { Sun, Moon } from 'lucide-react'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/workers', label: 'Workers' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/results', label: 'Results' },
]

const CONNECTION_LABEL = {
  connecting: 'Connecting…',
  online: 'Backend online',
  offline: 'Backend offline',
  error: 'Backend error',
} as const

export default function NavBar() {
  const pathname = usePathname()
  const connection = useArenaStore((s) => s.connection)
  const connectionMessage = useArenaStore((s) => s.connectionMessage)
  const episodeStatus = useArenaStore((s) => s.episodeStatus)
  const preset = useArenaStore((s) => s.preset)
  const runEpisode = useArenaStore((s) => s.runEpisode)
  const { theme, toggle } = useTheme()

  const canSwitch = connection === 'online' && episodeStatus !== 'loading'
  const dot = connection === 'online' ? 'var(--green)' : connection === 'connecting' ? 'var(--amber)' : 'var(--red)'

  return (
    <nav className="navbar">
      <div className="page-wide nav-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <Image
              src="/logo(1).svg"
              alt="Oversight Arena"
              width={28}
              height={28}
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              priority
            />
          </div>
          <span
            style={{
              fontFamily: 'DM Serif Display, Georgia, serif',
              fontSize: 18,
              color: 'var(--text-1)',
              letterSpacing: '-0.02em',
              fontWeight: 400,
            }}
          >
            Oversight Arena
          </span>
        </Link>

        <div className="nav-links">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname === `${href}/`
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: '0 14px',
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text-1)' : 'var(--text-3)',
                  textDecoration: 'none',
                  borderBottom: active ? '2px solid var(--text-1)' : '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                  letterSpacing: '-0.01em',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <div className="nav-right">
          <div
            role="status"
            title={connectionMessage ?? CONNECTION_LABEL[connection]}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span
              className={connection === 'connecting' ? 'pulse-dot' : undefined}
              style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dot }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{CONNECTION_LABEL[connection]}</span>
          </div>

          <div
            role="group"
            aria-label="Live episode difficulty"
            title="Sets the difficulty passed to POST /reset for the live episode. It does not switch between a baseline and a trained model."
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 3px 3px 8px',
              background: 'var(--surface)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <span className="hide-sm" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Episode difficulty
            </span>
            {(Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => void runEpisode(p)}
                disabled={!canSwitch}
                aria-pressed={preset === p}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: canSwitch ? 'pointer' : 'not-allowed',
                  fontFamily: 'Instrument Sans, sans-serif',
                  fontSize: 12,
                  fontWeight: 500,
                  color: preset === p ? 'var(--text-1)' : 'var(--text-3)',
                  background: preset === p ? 'var(--bg-card)' : 'transparent',
                  boxShadow: preset === p ? 'var(--shadow-sm)' : 'none',
                  opacity: canSwitch ? 1 : 0.5,
                }}
              >
                {DIFFICULTY_PRESETS[p].label} {DIFFICULTY_PRESETS[p].difficulty}
              </button>
            ))}
          </div>

          <button
            onClick={toggle}
            aria-label="Toggle colour theme"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-2)',
            }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>
    </nav>
  )
}
