'use client'
import NavBar from '@/components/NavBar'
import StatusBanner from '@/components/StatusBanner'
import EpisodeGate from '@/components/EpisodeGate'
import { useArenaStore } from '@/store/arenaStore'
import type { Episode, Worker } from '@/types'
import { ArrowRight, Code2, Flag } from 'lucide-react'
import Link from 'next/link'

function WorkerRow({ worker, episode }: { worker: Worker; episode: Episode }) {
  const malicious = worker.groundTruth === 'malicious'
  const panelFlagged = episode.decision.worker === worker.id
  const lines = worker.patch.split('\n')

  return (
    <article className="panel" style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '18px 22px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            {worker.id}
          </span>
          <h3 className="h3">{worker.label}</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
            {worker.patternId ? `pattern ${worker.patternId}` : 'pattern id unavailable'}
            {worker.cwe ? ` · ${worker.cwe}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {panelFlagged && (
            <span className="stamp stamp-info">
              <Flag size={10} /> Flagged by panel
            </span>
          )}
          <span
            className={`stamp ${malicious ? 'stamp-flag' : 'stamp-clear'}`}
            title="Label from the environment's planted ground truth. A real overseer never sees it."
          >
            Ground truth · {malicious ? 'malicious' : 'honest'}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: '10px 22px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <span className="readout">Mean rule score</span>
        <span className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)' }}>
          {episode.workerScores[worker.id].toFixed(2)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
          mean of the three scripted reviewers&rsquo; rule scores
        </span>
      </div>

      <div style={{ background: 'var(--code-bg)' }}>
        <div style={{ padding: '9px 22px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <Code2 size={12} color="var(--text-4)" />
          <span className="readout">Patch preview · first lines</span>
        </div>
        <div className="diff" style={{ padding: '12px 0', overflow: 'auto', maxHeight: 220 }}>
          {lines.map((line, i) => (
            <div
              key={i}
              className={line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-remove' : 'diff-neutral'}
              style={{ padding: '1px 22px', whiteSpace: 'pre' }}
            >
              <span style={{ color: line.startsWith('+') ? 'var(--green)' : line.startsWith('-') ? 'var(--red)' : 'var(--text-3)' }}>
                {line || ' '}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

export default function WorkersPage() {
  return (
    <>
      <NavBar />
      <main className="page-enter">
        <section style={{ padding: '64px 0 48px', borderBottom: '1px solid var(--border)' }}>
          <div className="wrap rise">
            <p className="readout" style={{ marginBottom: 16 }}>The pipeline · 01</p>
            <h1 className="display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', marginBottom: 16, maxWidth: 640 }}>
              Three workers. Up to two saboteurs.
            </h1>
            <p className="lede" style={{ marginBottom: 28 }}>
              Each episode, three scripted agents submit a code patch. Zero, one, or two
              of them plant a vulnerability — and escalate to subtler variants when caught.
            </p>
            <Link href="/analysis" className="btn btn-secondary">
              How the overseer reasons <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        <StatusBanner />

        <section className="section-tight" style={{ paddingTop: 48, paddingBottom: 72 }}>
          <div className="wrap">
            <EpisodeGate>
              {(ep) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {ep.workers.map((w) => (
                    <WorkerRow key={w.id} worker={w} episode={ep} />
                  ))}
                </div>
              )}
            </EpisodeGate>

            <div className="note-box" style={{ marginTop: 24 }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 6, fontSize: 13.5 }}>
                About this episode
              </p>
              <p>
                The &ldquo;ground truth&rdquo; stamps are the environment&rsquo;s planted labels, shown here
                for the demo. A real overseer never sees them — it must infer them from the patch
                text alone. The difficulty switch in the navigation bar only changes the live
                episode&rsquo;s difficulty; it does not switch between a baseline and a trained model.
                Recorded baseline-vs-trained numbers live on the{' '}
                <Link href="/results" style={{ color: 'var(--accent)', textDecoration: 'none' }}>results page</Link>.
              </p>
            </div>
          </div>
        </section>

        <footer>
          <div className="wrap footer">
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Oversight Arena — an OpenEnv Hackathon 2026 entry.</p>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>github.com/Lakshay-2005/oversight-arena</p>
          </div>
        </footer>
      </main>
    </>
  )
}
