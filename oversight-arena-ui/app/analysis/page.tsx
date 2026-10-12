'use client'
import { motion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import StatusBanner from '@/components/StatusBanner'
import EpisodeGate from '@/components/EpisodeGate'
import ScriptedPanelNote from '@/components/ScriptedPanelNote'
import { useArenaStore } from '@/store/arenaStore'
import type { Episode, ReviewerState } from '@/types'
import { Eye, AlertOctagon, CheckCircle, ArrowRight, GitBranch } from 'lucide-react'
import Link from 'next/link'

const EASE = [0.25, 0.1, 0.25, 1] as [number, number, number, number]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: EASE, delay },
})

function ReviewerRow({ reviewer, index, workers }: { reviewer: ReviewerState; index: number; workers: string[] }) {
  const isFlag = reviewer.action === 'FLAG'
  const barColor = reviewer.topScore >= 0.7 ? 'var(--red)' : reviewer.topScore >= 0.4 ? 'var(--amber)' : 'var(--green)'
  const topRules = reviewer.matchedRules[reviewer.topWorker] ?? []

  return (
    <motion.div {...fadeUp(index * 0.08)} className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Eye size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{reviewer.label}</h3>
              <span className="badge badge-blue" style={{ fontSize: 11 }}>{reviewer.profile} profile</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              Keyword-rule scorer · flags at ≥ <span className="num">{reviewer.threshold.toFixed(2)}</span>
            </p>
          </div>
        </div>

        <span className={`badge ${isFlag ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 14, padding: '6px 14px' }}>
          {isFlag ? <AlertOctagon size={13} /> : <CheckCircle size={13} />}
          {isFlag ? `FLAG ${reviewer.topWorker}` : 'PASS'}
        </span>
      </div>

      <div style={{ padding: '18px 22px' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Highest rule score ({reviewer.topWorker})</span>
            <span className="num" style={{ fontSize: 17, fontWeight: 600, color: barColor }}>{reviewer.topScore.toFixed(2)}</span>
          </div>
          <div style={{ position: 'relative', height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
            <motion.div
              key={`${reviewer.id}-${reviewer.topScore}`}
              initial={{ width: 0 }}
              animate={{ width: `${reviewer.topScore * 100}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: index * 0.1 }}
              style={{ height: '100%', background: barColor, borderRadius: 3 }}
            />
          </div>
          <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
            <span className="num" style={{ position: 'absolute', left: 0, fontSize: 11, color: 'var(--text-4)' }}>0</span>
            <span
              className="num"
              style={{ position: 'absolute', left: `${reviewer.threshold * 100}%`, transform: 'translateX(-50%)', fontSize: 11, color: 'var(--text-3)' }}
            >
              ▲ threshold
            </span>
            <span className="num" style={{ position: 'absolute', right: 0, fontSize: 11, color: 'var(--text-4)' }}>1</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {workers.map((w) => (
            <span key={w} className="badge badge-muted num">
              {w} {reviewer.scores[w].toFixed(2)}
            </span>
          ))}
        </div>

        <div style={{ background: 'var(--bg-2)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono" style={{ color: 'var(--text-3)', fontSize: 11 }}>rule-based explanation (template, not model output)</span>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <p className="font-mono" style={{ color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.65 }}>{reviewer.rationale}</p>
            <p className="font-mono" style={{ color: 'var(--text-3)', fontSize: 12, lineHeight: 1.65, marginTop: 8 }}>
              Rules matched on {reviewer.topWorker}: {topRules.length ? topRules.join('; ') : 'none (only the profile bias applies)'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function DiffPanel({ episode }: { episode: Episode }) {
  const { diffLines, focusWorker, decision, groundTruthMalicious } = episode
  const addCount = diffLines.filter((l) => l.type === 'add' || l.type === 'bug').length
  const removeCount = diffLines.filter((l) => l.type === 'remove').length
  const ruleHits = diffLines.filter((l) => l.type === 'bug').length
  const truth = groundTruthMalicious.includes(focusWorker) ? 'malicious' : 'honest'

  return (
    <motion.div {...fadeUp(0)} className="card sticky-panel" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: 'var(--bg-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch size={13} color="var(--text-3)" />
          <span className="font-mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>{focusWorker}/patch.diff</span>
        </div>
        <span className={`badge ${truth === 'malicious' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: 11 }} title="Environment ground truth, revealed after grading. Not something the panel saw.">
          Ground truth: {truth}
        </span>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 420 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ background: 'var(--bg-2)', padding: '12px 10px', borderRight: '1px solid var(--border)', minWidth: 38, textAlign: 'right', userSelect: 'none' }}>
            {diffLines.map((_, i) => (
              <div key={i} className="font-mono" style={{ lineHeight: '22px', fontSize: 11, color: 'var(--text-4)' }}>{i + 1}</div>
            ))}
          </div>
          <div style={{ flex: 1, padding: '12px 0', minWidth: 0 }}>
            {diffLines.map((line, i) => {
              const cls = line.type === 'bug' ? 'diff-bug' : line.type === 'remove' ? 'diff-remove' : line.type === 'add' ? 'diff-add' : line.type === 'header' ? 'diff-header' : 'diff-neutral'
              const color = line.type === 'bug' || line.type === 'remove' ? 'var(--red)' : line.type === 'add' ? 'var(--green)' : 'var(--text-3)'
              return (
                <div key={i} className={`font-mono ${cls}`} style={{ padding: '0 14px', lineHeight: '22px', whiteSpace: 'pre' }}>
                  <span style={{ color, fontSize: 13 }}>{line.text || ' '}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span className="font-mono" style={{ color: 'var(--green)', fontSize: 12 }}>+{addCount} addition{addCount !== 1 ? 's' : ''}</span>
        <span className="font-mono" style={{ color: 'var(--red)', fontSize: 12 }}>−{removeCount} deletion{removeCount !== 1 ? 's' : ''}</span>
        <span className="font-mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>{ruleHits} line{ruleHits !== 1 ? 's' : ''} matched a suspicious-pattern rule</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '10px 18px 14px', lineHeight: 1.5 }}>
        {decision.worker
          ? `Showing ${focusWorker}, the worker the panel flagged.`
          : `The panel flagged nobody. Showing ${focusWorker}, the patch with the highest mean rule score.`}{' '}
        Highlighted lines are keyword-rule matches, not a verified vulnerability location.
      </p>
    </motion.div>
  )
}

export default function AnalysisPage() {
  const episode = useArenaStore((s) => s.episode)

  return (
    <>
      <NavBar />
      <main className="page-enter">
        <section style={{ padding: '55px 0 44px', borderBottom: '1px solid var(--border)' }}>
          <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 22, flexWrap: 'wrap' }}>
              <div>
                <motion.p {...fadeUp(0)} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Step 2 of 3
                </motion.p>
                <motion.h1 {...fadeUp(0.06)} style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--text-1)', marginBottom: 10 }}>
                  Overseer Analysis
                </motion.h1>
                <motion.p {...fadeUp(0.1)} style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.5, letterSpacing: '-0.02em', maxWidth: 520 }}>
                  Three scripted heuristic reviewers score each worker&apos;s patch from its text alone. Their majority decision is then graded against the environment&apos;s
                  hidden ground truth.
                </motion.p>
              </div>
              <motion.div {...fadeUp(0.12)} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                {episode && (
                  <span className={`badge ${episode.outcome.kind === 'wrong' || episode.outcome.kind === 'missed' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 13, padding: '7px 14px' }}>
                    {episode.outcome.kind === 'correct' && 'Correct flag'}
                    {episode.outcome.kind === 'restraint' && 'Correct restraint'}
                    {episode.outcome.kind === 'missed' && 'Missed sabotage'}
                    {episode.outcome.kind === 'wrong' && 'False positive'}
                  </span>
                )}
                <Link href="/results">
                  <button className="btn btn-primary" style={{ fontSize: 14 }}>
                    View results <ArrowRight size={13} />
                  </button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        <StatusBanner />

        <section style={{ padding: '36px 0 88px' }}>
          <div className="page-wide">
            <EpisodeGate>
              {(ep) => (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <ScriptedPanelNote />
                  </div>
                  <div className="grid-analysis">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                      {ep.reviewers.map((r, i) => (
                        <ReviewerRow key={r.id} reviewer={r} index={i} workers={ep.workers.map((w) => w.id)} />
                      ))}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.01em', marginBottom: 12, fontWeight: 500 }}>
                        Patch under review ({ep.focusWorker})
                      </p>
                      <DiffPanel episode={ep} />
                    </div>
                  </div>
                </>
              )}
            </EpisodeGate>
          </div>
        </section>
      </main>
    </>
  )
}
