'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import StatusBanner from '@/components/StatusBanner'
import EpisodeGate from '@/components/EpisodeGate'
import RecordedComparison from '@/components/RecordedComparison'
import TrainingRewardChart from '@/components/TrainingRewardChart'
import ScriptedPanelNote from '@/components/ScriptedPanelNote'
import { useResults } from '@/hooks/useResults'
import { fmtMetric, type OtherExperiments, type Section } from '@/lib/evaluation'
import type { Episode } from '@/types'
import { AlertOctagon, CheckCircle, ArrowLeft } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number], delay },
})

const H2: React.CSSProperties = { fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-1)', marginBottom: 6 }
const LEAD: React.CSSProperties = { fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16, maxWidth: 680 }

function SectionState<T>({ section, children }: { section: Section<T> | undefined; children: (data: T) => React.ReactNode }) {
  if (section === undefined) {
    return (
      <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }} role="status">
        Loading recorded results…
      </div>
    )
  }
  if (!section.ok) {
    return (
      <div className="note-box" role="alert" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)' }}>
        <strong>Recorded results unavailable.</strong> {section.error}
      </div>
    )
  }
  return <>{children(section.data)}</>
}

function OtherExperimentsTable({ data }: { data: OtherExperiments }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Experiment</th>
              <th>n</th>
              <th>Mean F1</th>
              <th>Mean reward</th>
            </tr>
          </thead>
          <tbody>
            {data.ablation.map((r) => (
              <tr key={r.key}>
                <td>Ablation · {r.label}</td>
                <td className="num">{r.n}</td>
                <td className="num">{fmtMetric(r.meanF1)}</td>
                <td className="num">{fmtMetric(r.meanReward)}</td>
              </tr>
            ))}
            {data.groq && (
              <tr>
                <td>
                  Reference · {data.groq.label} zero-shot (difficulty {data.groq.difficulty})
                </td>
                <td className="num">{data.groq.n}</td>
                <td className="num">{fmtMetric(data.groq.meanF1)}</td>
                <td className="num">{fmtMetric(data.groq.meanReward)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 14 }}>
        Source: {data.sources.map((s) => `results/${s}`).join(', ')}. These use a different sample count (n = 20) than the Run 2 comparison above, so the F1
        values are not comparable with it. The ablation file does not record a difficulty. GRPO Run 1 (curriculum, difficulty 0.2–0.6) is described in the
        README and blog only; its raw evaluation files are not in <code>results/</code>, so it is not plotted here.
      </p>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>{label}</p>
      <p className="num" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-1)' }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{sub}</p>}
    </div>
  )
}

function LiveEpisode({ episode: ep }: { episode: Episode }) {
  const g = ep.grade
  const flagged = ep.decision.action === 'flag_worker'
  const bad = ep.outcome.kind === 'wrong' || ep.outcome.kind === 'missed'

  return (
    <>
      <div className="grid-votes" style={{ marginBottom: 20 }}>
        {ep.votes.map((v) => {
          const flag = v.action === 'FLAG'
          const rev = ep.reviewers.find((r) => r.id === v.reviewerId)
          return (
            <div key={v.reviewerId} className="card" style={{ padding: '18px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontFamily: 'DM Mono, monospace' }}>
                Heuristic {v.reviewerId}
                {rev ? ` · ${rev.profile}` : ''}
              </p>
              <span className={`badge ${flag ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 13, padding: '5px 12px' }}>
                {flag ? <AlertOctagon size={12} /> : <CheckCircle size={12} />}
                {flag ? `FLAG ${v.target}` : 'PASS'}
              </span>
            </div>
          )
        })}
      </div>

      <motion.div
        {...fadeUp(0)}
        style={{
          borderRadius: 16,
          padding: '28px 24px',
          marginBottom: 20,
          background: bad ? 'var(--red-bg)' : 'var(--green-bg)',
          border: `1px solid ${bad ? 'var(--red-border)' : 'var(--green-border)'}`,
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>
          Scripted panel decision · graded against environment ground truth
        </p>
        <h3 style={{ fontSize: 24, fontWeight: 600, color: bad ? 'var(--red)' : 'var(--green)', letterSpacing: '-0.03em' }}>
          {flagged ? `FLAG ${ep.decision.worker}` : 'ACCEPT ALL'}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5 }}>{ep.outcome.text}</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
          {ep.decision.flagVotes} of {ep.decision.totalVotes} reviewers voted FLAG (≥ 2 needed)
        </p>
      </motion.div>

      <div className="grid-stats" style={{ marginBottom: 14 }}>
        <Tile
          label="Episode F1 (this one episode)"
          value={g.f1 === null ? '—' : g.f1.toFixed(2)}
          sub={
            g.f1 === null
              ? 'The backend returned no valid F1.'
              : ep.groundTruthMalicious.length === 0 && g.fp === 0
                ? 'Clean episode with no flags: the grader scores this 1.00 by convention.'
                : 'Single-episode F1 from /grader.'
          }
        />
        <Tile label="Precision / recall" value={`${g.precision.toFixed(2)} / ${g.recall.toFixed(2)}`} sub={`TP ${g.tp} · FP ${g.fp} · FN ${g.fn}`} />
        <Tile
          label={g.done ? 'Terminal reward' : 'Reward so far (mean per step)'}
          value={g.reward.toFixed(3)}
          sub={g.done ? 'Episode finished.' : `Episode not finished: ${g.stepCount} of ${ep.maxTurns} steps used, so this is not the terminal reward.`}
        />
        <Tile label="Ground-truth malicious" value={ep.groundTruthMalicious.length ? ep.groundTruthMalicious.join(', ') : 'none'} sub={g.guardrails.length ? `Guardrails: ${g.guardrails.join(', ')}` : 'No guardrails triggered'} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
        Per-step reward: R = 0.65·F1 + 0.20·early + 0.10·recall − 0.20·FP-rate (see <code>oversight_arena/oversight_rewards.py</code>; terminal rewards also apply
        guardrails). One episode says nothing about model quality; use the recorded evaluation above for that.
      </p>
    </>
  )
}

export default function ResultsPage() {
  const results = useResults()

  return (
    <>
      <NavBar />
      <main className="page-enter">
        <section style={{ padding: '55px 0 44px', borderBottom: '1px solid var(--border)' }}>
          <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 22, flexWrap: 'wrap' }}>
              <div>
                <motion.p {...fadeUp(0)} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Step 3 of 3
                </motion.p>
                <motion.h1 {...fadeUp(0.06)} style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--text-1)', marginBottom: 10 }}>
                  Results
                </motion.h1>
                <motion.p {...fadeUp(0.1)} style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.5, letterSpacing: '-0.02em', maxWidth: 560 }}>
                  Recorded experiments, training history and the live episode are three different things and are kept in separate sections below.
                </motion.p>
              </div>
              <motion.div {...fadeUp(0.12)}>
                <Link href="/analysis">
                  <button className="btn btn-ghost" style={{ fontSize: 14 }}>
                    <ArrowLeft size={13} /> Back to analysis
                  </button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        <section style={{ padding: '44px 0 88px' }}>
          <div className="page-container">
            <div style={{ marginBottom: 48 }}>
              <h2 style={H2}>1 · Recorded evaluation: baseline vs GRPO</h2>
              <p style={LEAD}>Held-out episodes scored with the environment&apos;s grader. This is the evidence for whether training helped.</p>
              <SectionState section={results?.comparison}>{(c) => <RecordedComparison comparison={c} />}</SectionState>
            </div>

            <div style={{ marginBottom: 48 }}>
              <h2 style={H2}>2 · Training history</h2>
              <p style={LEAD}>
                Mean reward the GRPO trainer logged at each step. This is the training signal on training prompts, not held-out F1, so its level cannot be compared
                with the F1 values above.
              </p>
              <SectionState section={results?.training}>
                {(h) => (
                  <div className="card" style={{ padding: 24 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 12 }}>
                      {h.title} · {h.stats.n} logged steps · mean <span className="num">{h.stats.mean.toFixed(3)}</span> · min <span className="num">{h.stats.min.toFixed(3)}</span> · max{' '}
                      <span className="num">{h.stats.max.toFixed(3)}</span> · {h.meta.model}, {h.meta.epochs} epochs, {h.meta.numGenerations} generations/prompt,
                      lr {h.meta.learningRate.toExponential(0)}, KL β {h.meta.klBeta}
                    </p>
                    <TrainingRewardChart history={h} />
                    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 10 }}>
                      Source: results/{h.source}. The thin line is the raw logged reward; the thick line is a 10-step trailing average. Reward can be negative.
                    </p>
                    {h.warnings.length > 0 && (
                      <div className="note-box" role="alert" style={{ marginTop: 12, borderColor: 'var(--amber-border)', background: 'var(--amber-bg)' }}>
                        <strong>Data consistency warning:</strong> {h.warnings.join('; ')}
                      </div>
                    )}
                  </div>
                )}
              </SectionState>
            </div>

            <div style={{ marginBottom: 48 }}>
              <h2 style={H2}>3 · Other recorded experiments</h2>
              <p style={LEAD}>Separate experiments with their own sample counts. They are listed for provenance, not blended into the comparison above.</p>
              <SectionState section={results?.others}>{(o) => <OtherExperimentsTable data={o} />}</SectionState>
            </div>

            <div>
              <h2 style={H2}>4 · Live episode (interactive demo)</h2>
              <p style={LEAD}>
                One episode from the running backend, decided by the scripted rule panel and graded by <code>/grader</code>. It is telemetry for this single run, not a
                baseline-vs-trained comparison.
              </p>
              <div style={{ marginBottom: 16 }}>
                <ScriptedPanelNote />
              </div>
              <div style={{ margin: '0 0 20px', borderRadius: 10, overflow: 'hidden' }}>
                <StatusBanner />
              </div>
              <EpisodeGate>{(ep) => <LiveEpisode episode={ep} />}</EpisodeGate>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
