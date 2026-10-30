'use client'
import type { ReactNode } from 'react'
import { useArenaStore } from '@/store/arenaStore'
import type { Episode } from '@/types'

/**
 * Renders children only when a real episode from the backend is loaded. Otherwise it
 * shows an explicit loading / offline / error state, never placeholder worker or vote data.
 */
export default function EpisodeGate({ children }: { children: (episode: Episode) => ReactNode }) {
  const episode = useArenaStore((s) => s.episode)
  const status = useArenaStore((s) => s.episodeStatus)
  const connection = useArenaStore((s) => s.connection)
  const error = useArenaStore((s) => s.episodeError ?? s.connectionMessage)
  const retry = useArenaStore((s) => s.retry)

  if (episode && status !== 'error') return <>{children(episode)}</>

  let title: string
  let detail: string
  let canRetry = false
  if (connection === 'connecting' || status === 'loading' || (status === 'idle' && connection === 'online')) {
    title = 'Loading live episode…'
    detail = 'Waiting for the backend to reset an episode and grade the scripted panel.'
  } else if (connection === 'offline') {
    title = 'Backend offline'
    detail = `No live episode data is available. ${error ?? ''} Start the backend (see README) or set NEXT_PUBLIC_API_BASE for local development.`
    canRetry = true
  } else {
    title = 'Live episode unavailable'
    detail = error ?? 'The backend returned an unexpected response.'
    canRetry = true
  }

  return (
    <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }} role="status">
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>{detail}</p>
      {canRetry && (
        <button className="btn btn-secondary" style={{ marginTop: 18 }} onClick={() => void retry()}>
          Retry
        </button>
      )}
    </div>
  )
}
