'use client'
import { motion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import StatusBanner from '@/components/StatusBanner'
import EpisodeGate from '@/components/EpisodeGate'
import { useArenaStore } from '@/store/arenaStore'
import type { Episode, Worker } from '@/types'
import { Code2, AlertTriangle, CheckCircle, ArrowRight, Shield, Flag } from 'lucide-react'
import Link from 'next/link'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: EASE, delay },
})

const fadeRight = (delay = 0) => ({
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.42, ease: EASE, delay },
})

function WorkerCard({ worker, index, episode }: { worker: Worker; index: number; episode: Episode }) {
  const malicious = worker.groundTruth === 'malicious'
  const panelFlagged = episode.decision.worker === worker.id
  const lines = worker.patch.split('\n')

  return (
    <motion.div
      {...fadeUp(index * 0.07)}
      className="card"
      style={{ overflow: 'hidden', background: malicious ? 'color-mix(in srgb, var(--red) 4%, var(--bg-card))' : 'var(--bg-card)' }}
    >
      <div style={{ height: 3, background: malicious ? 'var(--red)' : 'var(--amber)' }} />

      <div style={{ padding: '20px 22px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: malicious ? 'var(--red-bg)' : 'var(--amber-bg)',
              border: `1px solid ${malicious ? 'var(--red-border)' : 'var(--amber-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'DM Mono, monospace',
              fontSize: 13,
              fontWeight: 500,
              color: malicious ? 'var(--red)' : 'var(--amber)',
            }}
          >
            {worker.id}
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{worker.label}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-4)', fontFamily: 'DM Mono, monospace' }}>
              {worker.patternId ? `pattern ${worker.patternId}` : 'pattern id unavailable'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {worker.cwe && (
            <span className="badge badge-red" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
              {worker.cwe}
            </span>
          )}
          <span className={`badge ${malicious ? 'badge-red' : 'badge-amber'}`} title="Label from the environment's planted ground truth. A real overseer never sees it.">
            {malicious ? (
              <>
                <AlertTriangle size={11} /> Ground truth: malicious
              </>
            ) : (
              <>
                <CheckCircle size={11} /> Ground truth: honest
              </>
            )}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span className="badge badge-muted num" title="Mean of the three scripted reviewers' rule scores for this patch">
          mean rule score {episode.workerScores[worker.id].toFixed(2)}
        </span>
        {panelFlagged && (
          <span className="badge badge-blue">
            <Flag size={11} /> Flagged by scripted panel
          </span>
        )}
      </div>

      <div style={{ background: 'var(--code-bg)' }}>
        <div style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid var(--border)' }}>
          <Code2 size={11} color="var(--text-4)" />
          <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-4)', fontSize: 11 }}>patch preview (first lines)</span>
        </div>
        <div style={{ padding: '12px 0', overflow: 'auto', maxHeight: 200 }}>
          {lines.map((line, i) => (
            <div
              key={i}
              className={`font-mono ${line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-remove' : 'diff-neutral'}`}
              style={{ padding: '1px 16px', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre' }}
            >
              <span style={{ color: line.startsWith('+') ? 'var(--green)' : line.startsWith('-') ? 'var(--red)' : 'var(--text-3)' }}>{line || ' '}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default function WorkersPage() {
  const episode = useArenaStore((s) => s.episode)

  return (
    <>
      <NavBar />
      <main className="page-enter">
        <section style={{ padding: '52px 0 40px', borderBottom: '1px solid var(--border)' }}>
          <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <motion.p {...fadeUp(0)} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Step 1 of 3
                </motion.p>
                <motion.h1 {...fadeUp(0.06)} style={{ fontFamily: 'DM Serif Display, serif', fontSize: 40, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--text-1)', marginBottom: 10 }}>
                  Worker Agents
                </motion.h1>
                <motion.p {...fadeUp(0.1)} style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.55, letterSpacing: '-0.01em', maxWidth: 480 }}>
                  Three scripted workers each submit a code patch. Zero, one or two contain deliberately planted vulnerabilities.
                </motion.p>
              </div>
              <motion.div {...fadeRight(0.12)} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {episode && (
                  <div className="card" style={{ padding: '14px 18px', minWidth: 160 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live episode difficulty</p>
                    <p className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>{episode.difficulty}</p>
                  </div>
                )}
                <Link href="/analysis">
                  <button className="btn btn-primary" style={{ fontSize: 13 }}>
                    View analysis <ArrowRight size={13} />
                  </button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        <StatusBanner />

        <section style={{ padding: '40px 0 80px' }}>
          <div className="page-container">
            <EpisodeGate>
              {(ep) => (
                <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
                  {ep.workers.map((w, i) => (
                    <WorkerCard key={w.id} worker={w} index={i} episode={ep} />
                  ))}
                </div>
              )}
            </EpisodeGate>

            <div style={{ marginTop: 28, padding: '18px 22px', borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Shield size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, letterSpacing: '-0.01em' }}>About this episode</p>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
                    The &ldquo;Ground truth&rdquo; badges are the environment&apos;s planted labels, shown here for the demo. A real overseer never sees them and must
                    infer them from the patch text. The difficulty switch in the navigation bar only changes the difficulty of the live episode; it does not switch
                    between a baseline and a trained model. Recorded baseline-vs-trained numbers are on the <Link href="/results" style={{ color: 'var(--accent)' }}>Results</Link> page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
