'use client'
import { motion } from 'framer-motion'
import { Award } from 'lucide-react'
import { fmtMetric, fmtSignedPct } from '@/lib/evaluation'
import type { DocumentedBest } from '@/lib/documented'

/** Percent exactly as printed in the docs (integer), unlike the computed one-decimal values. */
const reported = (pct: number): string => `+${pct}%`

/**
 * Headline: the best trained F1 as documented in the README (GRPO Run 1).
 * Clearly marked documentation-reported: Run 1's raw evaluation files are not in results/.
 */
export default function BestResultHero({ best }: { best: DocumentedBest }) {
  const conditions = [
    best.evalSeeds !== null ? `${best.evalSeeds} held-out seeds` : null,
    best.evalDifficulty !== null ? `difficulty ${best.evalDifficulty}` : null,
  ].filter(Boolean)

  return (
    <div className="card" style={{ padding: 28, borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))', background: 'linear-gradient(160deg, var(--accent-dim), var(--bg-card) 55%)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 18 }}>
        <Award size={16} color="var(--accent)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best trained F1</span>
        <span className="badge badge-blue">{best.title}</span>
        <span className="badge badge-amber" title="Run 1's raw evaluation files are not committed to results/">Documentation-reported</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 44px', alignItems: 'flex-end' }}>
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="num"
            style={{ fontSize: 'clamp(52px, 12vw, 76px)', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--accent)' }}
            aria-label={`Best trained F1 ${fmtMetric(best.trainedF1)}`}
          >
            {fmtMetric(best.trainedF1)}
          </motion.p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
            {best.title}
            {best.setup ? ` — ${best.setup}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Untrained baseline (README)</p>
            <p className="num" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-2)' }}>{fmtMetric(best.baselineF1)}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Relative improvement (as reported)</p>
            <p className="num" style={{ fontSize: 28, fontWeight: 600, color: 'var(--green)' }}>{reported(best.reportedRelPct)}</p>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 18 }}>
        Source: {best.source}, labelled “{best.readmeNote}”{conditions.length > 0 ? `; README evaluation: ${conditions.join(', ')}` : ''}.
      </p>

      <div className="note-box" style={{ marginTop: 14, borderColor: 'var(--amber-border)', background: 'var(--amber-bg)' }} role="note">
        <p style={{ marginBottom: 8 }}>
          <strong>Provenance.</strong> This figure is reported by the documentation, not computed from a committed measurement.{' '}
          {best.rawFilesStatement ?? 'Run 1’s raw evaluation files are not in results/.'} Its rewards and action distribution are therefore not shown.
        </p>
        {best.alternateBaselines.map((a) => (
          <p key={a.baselineF1} style={{ marginBottom: 8 }}>
            <strong>Documentation discrepancy.</strong> {a.sources.join(' and ')} give Run 1’s baseline as {fmtMetric(a.baselineF1)}, not {fmtMetric(best.baselineF1)}. They still
            print {reported(a.reportedRelPct)}, but {fmtMetric(a.trainedF1)} vs {fmtMetric(a.baselineF1)} is {fmtSignedPct(a.impliedRelPct)}, while the README’s baseline
            gives {fmtSignedPct(best.impliedRelPct)}, consistent with its {reported(best.reportedRelPct)}. This headline follows the README.
          </p>
        ))}
        {best.warnings.map((w) => (
          <p key={w} style={{ marginBottom: 8 }}>
            <strong>Note.</strong> {w}
          </p>
        ))}
        <p style={{ margin: 0 }}>The independently checkable comparison from committed files is Run 2, directly below.</p>
      </div>
    </div>
  )
}
