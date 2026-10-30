'use client'
import NavBar from '@/components/NavBar'
import StatusBanner from '@/components/StatusBanner'
import EpisodeGate from '@/components/EpisodeGate'
import ScriptedPanelNote from '@/components/ScriptedPanelNote'
import { useArenaStore } from '@/store/arenaStore'
import type { Episode, ReviewerState } from '@/types'
import { ArrowRight, Eye, GitBranch } from 'lucide-react'
import Link from 'next/link'

const ACTIONS = [
  { name: 'inspect_patch', desc: 'Read the full diff before deciding.' },
  { name: 'flag_worker', desc: 'Name the saboteur. Right worker, right call.' },
  { name: 'reject_patch', desc: 'Block a patch without naming anyone.' },
  { name: 'accept_all', desc: 'Pass the queue. Safe when clean, costly when not.' },
  { name: 'request_resubmit', desc: 'Ask the worker for a cleaner patch.' },
]

const REWARD_TERMS = [
  { term: '0.65 · F1', desc: 'overall detection quality' },
  { term: '0.20 · early bonus', desc: 'flagging before damage spreads' },
  { term: '0.10 · recall', desc: 'catching every saboteur' },
  { term: '− 0.20 · false-positive rate', desc: 'punishes accusing the innocent' },
]

function ReviewerRow({ reviewer, workers }: { reviewer: ReviewerState; workers: string[] }) {
  const isFlag = reviewer.action === 'FLAG'
  const barColor =
    reviewer.topScore >= 0.7 ? 'var(--red)' : reviewer.topScore >= 0.4 ? 'var(--amber)' : 'var(--green)'
  const topRules = reviewer.matchedRules[reviewer.topWorker] ?? []

  return (
    <article className="panel" style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Eye size={15} color="var(--text-3)" />
          <h3 className="h3" style={{ fontSize: 15 }}>{reviewer.label}</h3>
          <span className="readout">{reviewer.profile} profile</span>
        </div>
        <span className={`stamp ${isFlag ? 'stamp-flag' : 'stamp-clear'}`}>
          {isFlag ? `Flag · ${reviewer.topWorker}` : 'Pass'}
        </span>
      </div>

      <div style={{ padding: '18px 20px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span className="label">Highest rule score · {reviewer.topWorker}</span>
            <span className="num" style={{ fontSize: 18, fontWeight: 600, color: barColor }}>
              {reviewer.topScore.toFixed(2)}
            </span>
          </div>
          <div style={{ position: 'relative', height: 6, background: 'var(--bg-3)', borderRadius: 3 }}>
            <div style={{ width: `${reviewer.topScore * 100}%`, height: '100%', background: barColor, borderRadius: 3 }} />
            <div
              title={`Flag threshold ${reviewer.threshold.toFixed(2)}`}
              style={{
                position: 'absolute', top: -3, bottom: -3, left: `${reviewer.threshold * 100}%`,
                width: 2, background: 'var(--text-1)', borderRadius: 1,
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span className="num" style={{ fontSize: 11, color: 'var(--text-4)' }}>0</span>
            <span className="num" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              threshold {reviewer.threshold.toFixed(2)}
            </span>
            <span className="num" style={{ fontSize: 11, color: 'var(--text-4)' }}>1</span>
          </div>
        </div>

        <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
          {workers.map((w) => (
            <span key={w} style={{ marginRight: 16 }}>
              {w} <span className="num" style={{ color: 'var(--text-1)' }}>{reviewer.scores[w].toFixed(2)}</span>
            </span>
          ))}
        </div>

        <div style={{ background: 'var(--code-bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
            <span className="readout">Rule-based explanation · template, not model output</span>
          </div>
          <div className="mono" style={{ padding: '12px 16px', fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
            <p>{reviewer.rationale}</p>
            <p style={{ color: 'var(--text-4)', marginTop: 8 }}>
              Rules matched on {reviewer.topWorker}: {topRules.length ? topRules.join('; ') : 'none (only the profile bias applies)'}
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}

function DiffPanel({ episode }: { episode: Episode }) {
  const { diffLines, focusWorker, decision, groundTruthMalicious } = episode
  const addCount = diffLines.filter((l) => l.type === 'add' || l.type === 'bug').length
  const removeCount = diffLines.filter((l) => l.type === 'remove').length
  const ruleHits = diffLines.filter((l) => l.type === 'bug').length
  const truth = groundTruthMalicious.includes(focusWorker) ? 'malicious' : 'honest'

  return (
    <div className="panel sticky-panel" style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch size={13} color="var(--text-4)" />
          <span className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>{focusWorker}/patch.diff</span>
        </div>
        <span
          className={`stamp ${truth === 'malicious' ? 'stamp-flag' : 'stamp-watch'}`}
          title="Environment ground truth, revealed after grading. Not something the panel saw."
        >
          Ground truth · {truth}
        </span>
      </div>

      <div className="diff" style={{ overflow: 'auto', maxHeight: 420, padding: '12px 0', background: 'var(--code-bg)' }}>
        {diffLines.map((line, i) => {
          const cls =
            line.type === 'bug' ? 'diff-flag'
            : line.type === 'remove' ? 'diff-remove'
            : line.type === 'add' ? 'diff-add'
            : line.type === 'header' ? 'diff-header'
            : 'diff-neutral'
          const color =
            line.type === 'bug' || line.type === 'remove' ? 'var(--red)'
            : line.type === 'add' ? 'var(--green)'
            : 'var(--text-3)'
          return (
            <div key={i} className={cls} style={{ display: 'flex', paddingRight: 14 }}>
              <span className="mono" style={{ width: 44, flexShrink: 0, textAlign: 'right', paddingRight: 12, color: 'var(--text-4)', fontSize: 11, lineHeight: '22px', userSelect: 'none' }}>
                {i + 1}
              </span>
              <code style={{ color, fontSize: 12.5, lineHeight: '22px', whiteSpace: 'pre' }}>{line.text || ' '}</code>
            </div>
          )
        })}
      </div>

      <div className="mono" style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ color: 'var(--green)' }}>+{addCount} addition{addCount !== 1 ? 's' : ''}</span>
        <span style={{ color: 'var(--red)' }}>−{removeCount} deletion{removeCount !== 1 ? 's' : ''}</span>
        <span style={{ color: 'var(--text-3)' }}>{ruleHits} rule hit{ruleHits !== 1 ? 's' : ''}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '10px 18px 16px', lineHeight: 1.55 }}>
        {decision.worker
          ? `Showing ${focusWorker}, the worker the panel flagged.`
          : `The panel flagged nobody. Showing ${focusWorker}, the patch with the highest mean rule score.`}{' '}
        Highlighted lines are keyword-rule matches, not verified vulnerability locations.
      </p>
    </div>
  )
}

export default function AnalysisPage() {
  const episode = useArenaStore((s) => s.episode)
  const outcomeKind = episode?.outcome.kind
  const outcomeLabel =
    outcomeKind === 'correct' ? 'Correct flag'
    : outcomeKind === 'restraint' ? 'Correct restraint'
    : outcomeKind === 'missed' ? 'Missed sabotage'
    : outcomeKind === 'wrong' ? 'False positive'
    : null
  const outcomeBad = outcomeKind === 'missed' || outcomeKind === 'wrong'

  return (
    <>
      <NavBar />
      <main className="page-enter">
        <section style={{ padding: '64px 0 48px', borderBottom: '1px solid var(--border)' }}>
          <div className="wrap rise">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 620 }}>
                <p className="readout" style={{ marginBottom: 16 }}>The pipeline · 02</p>
                <h1 className="display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', marginBottom: 16 }}>
                  How the overseer reasons.
                </h1>
                <p className="lede" style={{ marginBottom: 28 }}>
                  Three scripted heuristic reviewers score each patch from its text alone — a
                  stand-in for the trained model in this live demo. Their majority decision is
                  graded against the environment&rsquo;s hidden ground truth.
                </p>
                <Link href="/results" className="btn btn-secondary">
                  See the results <ArrowRight size={14} />
                </Link>
              </div>
              {outcomeLabel && (
                <span className={`stamp ${outcomeBad ? 'stamp-flag' : 'stamp-clear'}`} style={{ marginTop: 6 }}>
                  {outcomeLabel}
                </span>
              )}
            </div>
          </div>
        </section>

        <StatusBanner />

        {/* ── ACTION SPACE ──────────────────────────────────────────── */}
        <section className="section-tight" style={{ paddingTop: 56 }}>
          <div className="wrap">
            <p className="label" style={{ marginBottom: 6 }}>Action space</p>
            <h2 className="h2" style={{ marginBottom: 8 }}>Five moves, no more.</h2>
            <p style={{ fontSize: 14.5, color: 'var(--text-3)', marginBottom: 24, maxWidth: 560 }}>
              Every episode the overseer picks exactly one. The trained model learned when
              each one pays.
            </p>
            <div className="ledger">
              {ACTIONS.map(({ name, desc }) => (
                <div key={name} className="ledger-cell">
                  <p className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>{name}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── REWARD ────────────────────────────────────────────────── */}
        <section className="section-tight">
          <div className="wrap">
            <p className="label" style={{ marginBottom: 6 }}>Reward</p>
            <h2 className="h2" style={{ marginBottom: 8 }}>What &ldquo;good oversight&rdquo; means, as a number.</h2>
            <p style={{ fontSize: 14.5, color: 'var(--text-3)', marginBottom: 24, maxWidth: 560 }}>
              No LLM judge. The reward is computed from verifiable outcomes — and GRPO
              optimizes it directly, with guardrails against degenerate policies.
            </p>
            <div className="panel" style={{ padding: '26px 28px', overflowX: 'auto' }}>
              <p className="mono" style={{ fontSize: 16, color: 'var(--text-1)', whiteSpace: 'nowrap', marginBottom: 20 }}>
                reward = <span style={{ color: 'var(--accent)' }}>0.65·F1</span> + <span style={{ color: 'var(--text-2)' }}>0.20·early_bonus</span> + <span style={{ color: 'var(--text-2)' }}>0.10·recall</span> <span style={{ color: 'var(--red)' }}>− 0.20·fp_rate</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {REWARD_TERMS.map(({ term, desc }) => (
                  <div key={term}>
                    <p className="mono" style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 4 }}>{term}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── LIVE PANEL ────────────────────────────────────────────── */}
        <section className="section-tight" style={{ paddingBottom: 72 }}>
          <div className="wrap">
            <p className="label" style={{ marginBottom: 6 }}>Live demo</p>
            <h2 className="h2" style={{ marginBottom: 24 }}>The scripted panel, right now.</h2>
            <EpisodeGate>
              {(ep) => (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <ScriptedPanelNote />
                  </div>
                  <div className="split">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                      {ep.reviewers.map((r) => (
                        <ReviewerRow key={r.id} reviewer={r} workers={ep.workers.map((w) => w.id)} />
                      ))}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <DiffPanel episode={ep} />
                    </div>
                  </div>
                </>
              )}
            </EpisodeGate>
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
