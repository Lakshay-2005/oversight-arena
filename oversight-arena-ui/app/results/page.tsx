'use client'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import StatusBanner from '@/components/StatusBanner'
import EpisodeGate from '@/components/EpisodeGate'
import BestResultHero from '@/components/BestResultHero'
import RecordedComparison from '@/components/RecordedComparison'
import TrainingRewardChart from '@/components/TrainingRewardChart'
import ScriptedPanelNote from '@/components/ScriptedPanelNote'
import { useResults } from '@/hooks/useResults'
import { fmtMetric, type OtherExperiments, type Section } from '@/lib/evaluation'
import type { Episode } from '@/types'
import { ArrowLeft } from 'lucide-react'

const LEAD: React.CSSProperties = { fontSize: 14.5, color: 'var(--text-3)', lineHeight: 1.65, maxWidth: 680 }

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
      <div className="note-box" role="alert" style={{ borderColor: 'var(--red-line)', background: 'var(--red-dim)' }}>
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
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.65, marginTop: 16 }}>
        Source: {data.sources.map((s) => `results/${s}`).join(', ')}. These use a different sample count (n = 20) than the Run 1 and Run 2 results above, so the F1
        values are not comparable with them. The ablation file does not record a difficulty. GRPO Run 1 appears only as the documentation-reported
        headline in section 1; its raw evaluation files are not in <code>results/</code>, so no further Run 1 detail is shown.
      </p>
    </div>
  )
}

function LiveEpisode({ episode: ep }: { episode: Episode }) {
  const g = ep.grade
  const flagged = ep.decision.action === 'flag_worker'
  const bad = ep.outcome.kind === 'wrong' || ep.outcome.kind === 'missed'

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        {ep.votes.map((v) => {
          const flag = v.action === 'FLAG'
          const rev = ep.reviewers.find((r) => r.id === v.reviewerId)
          return (
            <div key={v.reviewerId} className="panel" style={{ padding: '14px 16px' }}>
              <p className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                Heuristic {v.reviewerId}
                {rev ? ` · ${rev.profile}` : ''}
              </p>
              <span className={`stamp ${flag ? 'stamp-flag' : 'stamp-clear'}`}>
                {flag ? `Flag · ${v.target}` : 'Pass'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="panel" style={{ padding: '22px 24px', marginBottom: 16 }}>
        <p className="readout" style={{ marginBottom: 12 }}>Scripted panel decision · graded against environment ground truth</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className={`stamp ${bad ? 'stamp-flag' : 'stamp-clear'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {flagged ? `Flag · ${ep.decision.worker}` : 'Accept all'}
          </span>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            {ep.decision.flagVotes} of {ep.decision.totalVotes} reviewers voted flag (≥ 2 needed)
          </span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{ep.outcome.text}</p>
      </div>

      <div className="ledger" style={{ marginBottom: 14 }}>
        <div className="ledger-cell">
          <p className="ledger-value" style={{ fontSize: 24 }}>{g.f1 === null ? '—' : g.f1.toFixed(2)}</p>
          <p className="ledger-label">Episode F1</p>
          <p className="ledger-sub">
            {g.f1 === null
              ? 'The backend returned no valid F1.'
              : ep.groundTruthMalicious.length === 0 && g.fp === 0
                ? 'Clean episode, no flags: the grader scores this 1.00 by convention.'
                : 'Single-episode F1 from /grader.'}
          </p>
        </div>
        <div className="ledger-cell">
          <p className="ledger-value" style={{ fontSize: 24 }}>{g.precision.toFixed(2)} / {g.recall.toFixed(2)}</p>
          <p className="ledger-label">Precision / recall</p>
          <p className="ledger-sub">TP {g.tp} · FP {g.fp} · FN {g.fn}</p>
        </div>
        <div className="ledger-cell">
          <p className="ledger-value" style={{ fontSize: 24 }}>{g.reward.toFixed(3)}</p>
          <p className="ledger-label">{g.done ? 'Terminal reward' : 'Reward so far'}</p>
          <p className="ledger-sub">
            {g.done ? 'Episode finished.' : `${g.stepCount} of ${ep.maxTurns} steps used — not the terminal reward.`}
          </p>
        </div>
        <div className="ledger-cell">
          <p className="ledger-value" style={{ fontSize: 24 }}>
            {ep.groundTruthMalicious.length ? ep.groundTruthMalicious.join(', ') : 'none'}
          </p>
          <p className="ledger-label">Ground-truth malicious</p>
          <p className="ledger-sub">{g.guardrails.length ? `Guardrails: ${g.guardrails.join(', ')}` : 'No guardrails triggered'}</p>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.65 }}>
        Per-step reward: R = 0.65·F1 + 0.20·early + 0.10·recall − 0.20·FP-rate (see <code>oversight_arena/oversight_rewards.py</code>; terminal rewards also apply
        guardrails). One episode says nothing about model quality; use the recorded evaluation above for that.
      </p>
    </>
  )
}

function SectionHead({ index, provenance, title, children }: { index: string; provenance: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p className="readout" style={{ marginBottom: 8 }}>{index} · {provenance}</p>
      <h2 className="h2" style={{ marginBottom: 8 }}>{title}</h2>
      <div style={LEAD}>{children}</div>
    </div>
  )
}

export default function ResultsPage() {
  const results = useResults()

  return (
    <>
      <NavBar />
      <main className="page-enter">
        <section style={{ padding: '64px 0 48px', borderBottom: '1px solid var(--border)' }}>
          <div className="wrap rise">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 640 }}>
                <p className="readout" style={{ marginBottom: 16 }}>The pipeline · 03</p>
                <h1 className="display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', marginBottom: 16 }}>
                  The numbers, with receipts.
                </h1>
                <p className="lede">
                  The documented best run, the committed Run 2 evaluation, the training
                  log, and the live episode are different kinds of evidence. They stay in
                  separate sections, each labelled with where it came from.
                </p>
              </div>
              <Link href="/analysis" className="btn btn-ghost" style={{ fontSize: 14 }}>
                <ArrowLeft size={14} /> Back to analysis
              </Link>
            </div>
          </div>
        </section>

        <section style={{ padding: '56px 0 88px' }}>
          <div className="wrap">
            <div style={{ marginBottom: 56 }}>
              <SectionHead index="01" provenance="Documentation" title="Best result: GRPO Run 1">
                The README&rsquo;s headline result. It is reported by the project documentation; its raw evaluation files are not in the repository.
              </SectionHead>
              <SectionState section={results?.documented}>{(d) => <BestResultHero best={d} />}</SectionState>
            </div>

            <div style={{ marginBottom: 56 }}>
              <SectionHead index="02" provenance="Committed files" title="Run 2: baseline vs GRPO">
                A separate run at fixed difficulty 0.4, measured from the committed evaluation files. Its trained F1 is <strong>not</strong> the Run 1 figure above; the two
                runs are never combined.
              </SectionHead>
              <SectionState section={results?.comparison}>{(c) => <RecordedComparison comparison={c} />}</SectionState>
            </div>

            <div style={{ marginBottom: 56 }}>
              <SectionHead index="03" provenance="Training log" title="Training history">
                Mean reward the GRPO trainer logged at each step. This is the training signal on training prompts, not held-out F1, so its level cannot be compared
                with the F1 values above.
              </SectionHead>
              <SectionState section={results?.training}>
                {(h) => (
                  <div className="card" style={{ padding: 24 }}>
                    <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 16 }}>
                      {h.title} · {h.stats.n} logged steps · mean <span className="num" style={{ color: 'var(--text-1)' }}>{h.stats.mean.toFixed(3)}</span> · min <span className="num">{h.stats.min.toFixed(3)}</span> · max{' '}
                      <span className="num">{h.stats.max.toFixed(3)}</span> · {h.meta.model}, {h.meta.epochs} epochs, {h.meta.numGenerations} generations/prompt,
                      lr {h.meta.learningRate.toExponential(0)}, KL β {h.meta.klBeta}
                    </p>
                    <TrainingRewardChart history={h} />
                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.65, marginTop: 12 }}>
                      Source: results/{h.source}. The thin line is the raw logged reward; the thick line is a 10-step trailing average. Reward can be negative.
                    </p>
                    {h.warnings.length > 0 && (
                      <div className="note-box" role="alert" style={{ marginTop: 12 }}>
                        <strong>Data consistency warning:</strong> {h.warnings.join('; ')}
                      </div>
                    )}
                  </div>
                )}
              </SectionState>
            </div>

            <div style={{ marginBottom: 56 }}>
              <SectionHead index="04" provenance="Committed files" title="Other experiments">
                Separate experiments with their own sample counts. Listed for provenance, not blended into the Run 1 or Run 2 results above.
              </SectionHead>
              <SectionState section={results?.others}>{(o) => <OtherExperimentsTable data={o} />}</SectionState>
            </div>

            <div>
              <SectionHead index="05" provenance="Live · this backend" title="One live episode">
                A single episode from the running backend, decided by the scripted rule panel and graded by <code>/grader</code>. Telemetry for this run, not a
                baseline-vs-trained comparison.
              </SectionHead>
              <div style={{ marginBottom: 16 }}>
                <ScriptedPanelNote />
              </div>
              <div style={{ margin: '0 0 20px', borderRadius: 12, overflow: 'hidden' }}>
                <StatusBanner />
              </div>
              <EpisodeGate>{(ep) => <LiveEpisode episode={ep} />}</EpisodeGate>
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
