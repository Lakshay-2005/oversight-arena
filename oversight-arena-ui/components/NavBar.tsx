'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useArenaStore } from '@/store/arenaStore'
import { useTheme } from '@/context/ThemeContext'
import { DIFFICULTY_PRESETS, type DifficultyPreset } from '@/types'
import { Sun, Moon } from 'lucide-react'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/workers', label: 'Workers' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/results', label: 'Results' },
]

const CONNECTION_LABEL = {
  connecting: 'Connecting',
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
  const dot =
    connection === 'online'
      ? 'var(--green)'
      : connection === 'connecting'
        ? 'var(--amber)'
        : 'var(--red)'

  return (
    <nav className="navbar">
      <div className="wrap nav-inner">
        <Link href="/" className="wordmark" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.svg" alt="" width={26} height={26} priority style={{ flexShrink: 0 }} />
          Oversight Arena
        </Link>

        <div className="nav-links">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname === `${href}/`
            return (
              <Link key={href} href={href} className={`nav-link${active ? ' active' : ''}`}>
                {label}
              </Link>
            )
          })}
        </div>

        <div className="nav-right">
          <div
            role="status"
            title={connectionMessage ?? CONNECTION_LABEL[connection]}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <span
              className={connection === 'connecting' ? 'pulse-dot' : undefined}
              style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dot }}
            />
            <span className="readout" style={{ letterSpacing: '0.04em' }}>
              {CONNECTION_LABEL[connection]}
            </span>
          </div>

          <div className="segment hide-sm" role="group" aria-label="Live episode difficulty">
            {(Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => void runEpisode(p)}
                disabled={!canSwitch}
                aria-pressed={preset === p}
                title="Sets the difficulty passed to POST /reset for the live episode"
              >
                {DIFFICULTY_PRESETS[p].label}
              </button>
            ))}
          </div>

          <button onClick={toggle} aria-label="Toggle colour theme" className="icon-btn">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </nav>
  )
}
