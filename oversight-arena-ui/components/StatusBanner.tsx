'use client'
import { useArenaStore } from '@/store/arenaStore'
import { Activity, AlertTriangle, Loader2, RefreshCw, WifiOff } from 'lucide-react'

/**
 * Connection + live-episode status. Says plainly that the live episode is a single
 * interactive run graded by the backend, scored by scripted rules, and is not the
 * recorded baseline-vs-trained evaluation.
 */
export default function StatusBanner() {
  const connection = useArenaStore((s) => s.connection)
  const connectionMessage = useArenaStore((s) => s.connectionMessage)
  const episodeStatus = useArenaStore((s) => s.episodeStatus)
  const episodeError = useArenaStore((s) => s.episodeError)
  const episode = useArenaStore((s) => s.episode)
  const retry = useArenaStore((s) => s.retry)
  const runEpisode = useArenaStore((s) => s.runEpisode)

  let tone: 'muted' | 'red' | 'green' = 'muted'
  let icon = <Activity size={15} />
  let text: string
  let action: { label: string; run: () => void } | null = null

  if (connection === 'connecting') {
    icon = <Loader2 size={15} className="pulse-dot" />
    text = 'Connecting to the backend…'
  } else if (connection === 'offline') {
    tone = 'red'
    icon = <WifiOff size={15} />
    text = `Backend unreachable${connectionMessage ? ` — ${connectionMessage}` : ''}. No episode data is shown; retrying automatically every 10 s.`
    action = { label: 'Retry now', run: () => void retry() }
  } else if (connection === 'error' || episodeStatus === 'error') {
    tone = 'red'
    icon = <AlertTriangle size={15} />
    text =
      episodeStatus === 'error'
        ? `Backend reachable but the live episode failed — ${episodeError ?? 'unexpected response'}.`
        : `Backend health check failed — ${connectionMessage ?? 'unexpected response'}.`
    action = { label: 'Retry', run: () => void retry() }
  } else if (episodeStatus === 'loading' || episodeStatus === 'idle') {
    icon = <Loader2 size={15} className="pulse-dot" />
    text = 'Backend online — loading a live episode…'
  } else if (episode) {
    tone = 'green'
    text = `Live episode ${episode.episodeId.slice(0, 8)} (seed ${episode.seed}) · difficulty ${episode.difficulty} · one interactive run scored by a scripted rule panel (not an LLM). Not the recorded baseline-vs-trained evaluation.`
    action = { label: 'New episode', run: () => void runEpisode() }
  } else {
    text = 'No episode loaded.'
    action = { label: 'Load episode', run: () => void runEpisode() }
  }

  const bg = tone === 'red' ? 'var(--red-bg)' : tone === 'green' ? 'var(--green-bg)' : 'var(--bg-2)'
  const fg = tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--text-2)'

  return (
    <section role="status" aria-live="polite" style={{ background: bg, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div
        className="page-container"
        style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: fg, flex: '1 1 320px', minWidth: 0 }}>
          <span style={{ marginTop: 2, flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 13.5, color: 'var(--text-1)', lineHeight: 1.5, letterSpacing: '-0.01em' }}>{text}</span>
        </div>
        {action && (
          <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={action.run} disabled={episodeStatus === 'loading'}>
            <RefreshCw size={12} /> {action.label}
          </button>
        )}
      </div>
    </section>
  )
}
