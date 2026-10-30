'use client'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import EpisodeBoard from '@/components/EpisodeBoard'
import StatusBanner from '@/components/StatusBanner'
import { useResults } from '@/hooks/useResults'
import { fmtMetric, fmtSignedMetric, fmtSignedPct, type EvalComparison, type TrainingHistory } from '@/lib/evaluation'
import type { DocumentedBest } from '@/lib/documented'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

interface Cell {
  label: string
  value: string
  sub: string
  hot?: boolean
}

function ledgerCells(
  documented: DocumentedBest | null,
  comparison: EvalComparison | null,
  training: TrainingHistory | null,
  loading: boolean,
  errors: string[],
): Cell[] {
  const unavailable = loading
    ? 'Loading recorded results…'
    : `Recorded results unavailable: ${errors.join('; ') || 'unknown error'}`
  const f1: Cell = documented
    ? {
        label: `Best trained F1 · ${documented.title}`,
        value: `${fmtMetric(documented.baselineF1)} → ${fmtMetric(documented.trainedF1)}`,
        sub:
          `untrained → GRPO, +${documented.reportedRelPct}% as reported in the README (raw files not committed)` +
          (comparison
            ? ` · Run 2, committed files, n=${comparison.n}: ${fmtMetric(comparison.baseline.f1)} → ${fmtMetric(comparison.trained.f1)}`
            : ''),
        hot: true,
      }
    : comparison
      ? {
          label: `Held-out F1 · ${comparison.experimentId}`,
          value: `${fmtMetric(comparison.baseline.f1)} → ${fmtMetric(comparison.trained.f1)}`,
          sub: `baseline → GRPO · n=${comparison.n}, difficulty ${comparison.difficulty} · ${fmtSignedMetric(comparison.delta.f1Abs)} (${fmtSignedPct(comparison.delta.f1RelPct)})`,
          hot: true,
        }
      : { label: 'Held-out F1', value: '—', sub: unavailable }
  return [
    f1,
    { label: 'Worker agents', value: '3', sub: 'scripted workers · 0–2 malicious per episode' },
    // 11 patterns × 3 malicious variants each (oversight_arena/sabotage_catalog.py).
    { label: 'Sabotage variants', value: '33', sub: '11 CWE patterns × 3 escalation variants' },
    training
      ? {
          label: 'Training',
          value: 'GRPO',
          sub: `${training.meta.model} · ${training.meta.epochs} epochs · ${training.stats.n} logged steps`,
        }
      : { label: 'Training', value: '—', sub: unavailable },
  ]
}

const PIPELINE = [
  {
    n: '01',
    title: 'Workers',
    href: '/workers',
    link: 'Meet the workers',
    desc: 'Three scripted agents submit code patches. Zero to two of them hide a CWE-grounded vulnerability — and escalate to subtler variants when they get caught.',
  },
  {
    n: '02',
    title: 'Overseer',
    href: '/analysis',
    link: 'How it reasons',
    desc: 'A 1.5B-parameter model inspects each patch and chooses: flag, reject, resubmit, or accept. Ground truth comes from executable unit tests — no LLM judge anywhere.',
  },
  {
    n: '03',
    title: 'Reward',
    href: '/results',
    link: 'See the training',
    desc: 'Reward = 0.65·F1 + 0.20·early bonus + 0.10·recall − 0.20·false-positive rate. GRPO turns that score into a sharper overseer, episode by episode.',
  },
]

export default function Home() {
  const results = useResults()
  const comparison = results?.comparison.ok ? results.comparison.data : null
  const training = results?.training.ok ? results.training.data : null
  const errors = results
    ? [results.comparison, results.training].flatMap((s) => (s.ok ? [] : [s.error]))
    : []
  const documented = results?.documented.ok ? results.documented.data : null
  const cells = ledgerCells(documented, comparison, training, results === null, errors)

  return (
    <>
      <NavBar />
      <main className="page-enter">
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section style={{ padding: '88px 0 76px' }}>
          <div className="wrap">
            <div className="hero-grid rise">
              <div>
                <p className="readout" style={{ marginBottom: 22 }}>
                  Meta × PyTorch OpenEnv Hackathon 2026
                </p>
                <h1 className="display" style={{ marginBottom: 22, maxWidth: 480 }}>
                  Catch the saboteur in the patch&nbsp;queue.
                </h1>
                <p className="lede" style={{ marginBottom: 36 }}>
                  Three worker agents submit code patches every episode. Up to two hide
                  CWE-grounded vulnerabilities. A Qwen-2.5-1.5B overseer, trained with
                  GRPO, learns to flag them — no LLM judge in the loop.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href="/results" className="btn btn-primary">
                    See the results <ArrowRight size={15} />
                  </Link>
                  <Link href="/workers" className="btn btn-secondary">
                    Meet the workers
                  </Link>
                </div>
              </div>
              <EpisodeBoard />
            </div>
          </div>
        </section>

        {/* ── LIVE BACKEND / EPISODE STATUS ─────────────────────────── */}
        <StatusBanner />

        {/* ── RECORDED RESULTS ──────────────────────────────────────── */}
        <section className="section-tight" style={{ paddingTop: 64 }}>
          <div className="wrap">
            <p className="label" style={{ marginBottom: 18 }}>Recorded results · committed evaluation files</p>
            <div className="ledger" style={{ marginBottom: 16 }}>
              {cells.map(({ label, value, sub, hot }) => (
                <div key={label} className="ledger-cell">
                  <p className="ledger-value" style={hot ? { color: 'var(--accent)' } : undefined}>{value}</p>
                  <p className="ledger-label">{label}</p>
                  <p className="ledger-sub">{sub}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)' }}>
              Saved evaluations, separate from the live episode above.{' '}
              <Link href="/results" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Full results and provenance <ArrowUpRight size={13} style={{ verticalAlign: -1 }} />
              </Link>
            </p>
          </div>
        </section>

        {/* ── PIPELINE ──────────────────────────────────────────────── */}
        <section className="section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)', marginTop: 40 }}>
          <div className="wrap">
            <p className="label" style={{ marginBottom: 8 }}>The pipeline</p>
            <h2 className="h2" style={{ marginBottom: 40, maxWidth: 560 }}>
              Three roles, one loop: submit, inspect, learn.
            </h2>
            <div className="pipe">
              {PIPELINE.map(({ n, title, href, link, desc }) => (
                <div key={n} className="pipe-step">
                  <span className="pipe-num">{n}</span>
                  <h3 className="h3" style={{ marginBottom: 10 }}>{title}</h3>
                  <p style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 16, maxWidth: 340 }}>
                    {desc}
                  </p>
                  <Link
                    href={href}
                    style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    {link} <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────── */}
        <footer>
          <div className="wrap footer">
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Oversight Arena — an OpenEnv Hackathon 2026 entry.
            </p>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
              github.com/Lakshay-2005/oversight-arena
            </p>
          </div>
        </footer>
      </main>
    </>
  )
}
