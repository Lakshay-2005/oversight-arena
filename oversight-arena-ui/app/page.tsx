'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import OversightScene from '@/components/OversightScene'
import StatusBanner from '@/components/StatusBanner'
import { useResults } from '@/hooks/useResults'
import { fmtMetric, fmtSignedMetric, fmtSignedPct, type EvalComparison, type TrainingHistory } from '@/lib/evaluation'
import type { DocumentedBest } from '@/lib/documented'
import { ArrowRight, Shield, Cpu, TrendingUp, Activity } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay },
})

const fadeRight = (delay = 0) => ({
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay },
})

interface Tile {
  label: string
  value: string
  sub: string
  accent?: boolean
}

function recordedTiles(
  documented: DocumentedBest | null,
  comparison: EvalComparison | null,
  training: TrainingHistory | null,
  loading: boolean,
  errors: string[],
): Tile[] {
  const unavailable = loading ? 'Loading recorded results…' : `Recorded results unavailable: ${errors.join('; ') || 'unknown error'}`
  return [
    { label: 'Worker Agents', value: '3', sub: 'scripted workers · 0–2 malicious per episode' },
    documented
      ? {
          label: `Best trained F1 · ${documented.title}`,
          value: `${fmtMetric(documented.baselineF1)} → ${fmtMetric(documented.trainedF1)}`,
          sub:
            `untrained → GRPO, +${documented.reportedRelPct}% as reported in the README (raw files not committed)` +
            (comparison
              ? ` · Run 2, committed files, n=${comparison.n}, difficulty ${comparison.difficulty}: ${fmtMetric(comparison.baseline.f1)} → ${fmtMetric(comparison.trained.f1)} (${fmtSignedMetric(comparison.delta.f1Abs)} abs)`
              : ''),
          accent: true,
        }
      : comparison
        ? {
            label: `Held-out F1 · ${comparison.experimentId}`,
            value: `${fmtMetric(comparison.baseline.f1)} → ${fmtMetric(comparison.trained.f1)}`,
            sub: `baseline → GRPO · n=${comparison.n}, difficulty ${comparison.difficulty} · ${fmtSignedMetric(comparison.delta.f1Abs)} abs (${fmtSignedPct(comparison.delta.f1RelPct)} rel)`,
            accent: true,
          }
        : { label: 'Held-out F1', value: '—', sub: unavailable },
    // 11 patterns × 3 malicious variants each (oversight_arena/sabotage_catalog.py).
    { label: 'Sabotage Variants', value: '33', sub: '11 CWE patterns × 3 escalation variants' },
    training
      ? {
          label: 'Training',
          value: 'GRPO',
          sub: `${training.meta.model} · ${training.meta.epochs} epochs · ${training.stats.n} logged steps`,
          accent: true,
        }
      : { label: 'Training', value: '—', sub: unavailable },
  ]
}

export default function Home() {
  const results = useResults()
  const comparison = results?.comparison.ok ? results.comparison.data : null
  const training = results?.training.ok ? results.training.data : null
  const errors = results
    ? [results.comparison, results.training].flatMap((s) => (s.ok ? [] : [s.error]))
    : []
  const documented = results?.documented.ok ? results.documented.data : null
  const tiles = recordedTiles(documented, comparison, training, results === null, errors)

  const inspect = comparison?.actionDistribution
  const rewardDesc =
    'Reward = 0.65·F1 + 0.20·early_bonus + 0.10·recall − 0.20·FP rate. Anti-hack guardrails prevent degenerate policies.' +
    (comparison && inspect
      ? ` In the ${comparison.experimentId} held-out evaluation (n=${comparison.n}) the trained model's final action was inspect_patch in ${inspect.trained.inspect_patch ?? 0} episodes vs ${inspect.baseline.inspect_patch ?? 0} for the baseline.`
      : '')

  return (
    <>
      <NavBar />
      <main>
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section style={{ padding: '80px 0 64px', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
          <div
            className="grid-bg"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.4,
              maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)',
            }}
          />

          <div className="page-container" style={{ position: 'relative' }}>
            <div className="grid-hero">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <motion.div {...fadeUp(0)}>
                  <span className="badge badge-blue" style={{ marginBottom: 24 }}>
                    <Activity size={11} />
                    Meta × PyTorch OpenEnv Hackathon 2026
                  </span>
                </motion.div>

                <motion.h1
                  {...fadeUp(0.06)}
                  style={{
                    fontFamily: 'DM Serif Display, Georgia, serif',
                    fontSize: 'clamp(38px, 5vw, 68px)',
                    fontWeight: 400,
                    color: 'var(--text-1)',
                    letterSpacing: '-0.03em',
                    lineHeight: 1.05,
                    marginBottom: 20,
                    textAlign: 'left',
                  }}
                >
                  Oversight
                  <br />
                  <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Arena</em>
                </motion.h1>

                <motion.p
                  {...fadeUp(0.1)}
                  style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.6, letterSpacing: '-0.01em', maxWidth: 440, marginBottom: 36, textAlign: 'left' }}
                >
                  Three scripted worker agents submit code patches per episode. 0–2 inject CWE-grounded vulnerabilities. A Qwen-2.5-1.5B overseer,
                  trained via GRPO, learns to flag malicious workers — no LLM judge anywhere in the loop.
                </motion.p>

                <motion.div {...fadeUp(0.14)} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href="/workers">
                    <button className="btn btn-primary">
                      View Workers <ArrowRight size={14} />
                    </button>
                  </Link>
                  <Link href="/results">
                    <button className="btn btn-secondary">See Results</button>
                  </Link>
                </motion.div>
              </div>

              <motion.div {...fadeRight(0.18)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
                <OversightScene />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── LIVE BACKEND / EPISODE STATUS ─────────────────────────────── */}
        <StatusBanner />

        {/* ── RECORDED RESULTS (from results/*.json, not the live episode) ─ */}
        <section style={{ padding: '56px 0' }}>
          <div className="page-container">
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
              Recorded results · committed evaluation files
            </p>
            <div className="grid-stats" style={{ marginBottom: 16 }}>
              {tiles.map(({ label, value, sub, accent }) => (
                <div key={label} className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                  <p className="stat-number" style={{ fontSize: value.length > 6 ? 28 : 36, color: accent ? 'var(--accent)' : 'var(--text-1)' }}>{value}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>{sub}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              These are saved evaluations, separate from the live episode above. <Link href="/results" style={{ color: 'var(--accent)' }}>Full results and provenance →</Link>
            </p>
          </div>
        </section>

        {/* ── PIPELINE STEPS ──────────────────────────────────────────── */}
        <section style={{ padding: '0 0 72px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
          <div className="page-container" style={{ paddingTop: 56 }}>
            <motion.div {...fadeUp(0)} style={{ marginBottom: 40 }}>
              <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 34, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--text-1)', marginBottom: 8 }}>
                How it works
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-3)', letterSpacing: '-0.01em' }}>
                Follow the oversight pipeline from patch submission to reward-driven detection.
              </p>
            </motion.div>

            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
              {[
                {
                  n: 1,
                  icon: Shield,
                  title: 'Worker Agents',
                  href: '/workers',
                  color: 'var(--amber)',
                  bg: 'var(--amber-bg)',
                  desc: 'Three scripted workers submit unified-diff code patches. 0–2 inject CWE-grounded subtle vulnerabilities. Adaptive adversaries escalate to subtler variants when flagged.',
                },
                {
                  n: 2,
                  icon: Cpu,
                  title: 'Overseer Analysis',
                  href: '/analysis',
                  color: 'var(--accent)',
                  bg: 'var(--accent-dim)',
                  desc: 'The Qwen-2.5-1.5B overseer chooses from inspect_patch, flag_worker, reject_patch, accept_all, or request_resubmit. Ground truth is verified by executable unit tests — no LLM judge. The live demo here uses a scripted rule panel instead of the model.',
                },
                { n: 3, icon: TrendingUp, title: 'Reward & Training', href: '/results', color: 'var(--green)', bg: 'var(--green-bg)', desc: rewardDesc },
              ].map(({ n, icon: Icon, title, href, color, bg, desc }, i) => (
                <motion.div key={n} {...fadeUp(i * 0.08)}>
                  <Link href={href} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ padding: '28px 24px', cursor: 'pointer', height: '100%' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Icon size={20} color={color} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Step {n}</div>
                      <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 8 }}>{title}</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55, letterSpacing: '-0.01em' }}>{desc}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
