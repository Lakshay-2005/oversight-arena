'use client'
import { fmtExact, fmtMetric, fmtSignedMetric, fmtSignedPct, type EvalComparison } from '@/lib/evaluation'

const LABEL: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-3)',
  marginBottom: 10,
  fontWeight: 500,
}

function Bar({ label, value, color, delay = 0 }: { label: string; value: number; color: string; delay?: number }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{label}</span>
        <span className="num" style={{ fontSize: 13, fontWeight: 500, color }} title={`exact: ${fmtExact(value)}`}>
          {fmtMetric(value)}
        </span>
      </div>
      {/* Full 0–1 axis: bar length is the F1 value itself. */}
      <div
        style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}
        role="img"
        aria-label={`${label}: F1 ${fmtMetric(value)} on a 0 to 1 scale`}
      >
        <div className="bar-grow" style={{ width: `${value * 100}%`, height: '100%', background: color, borderRadius: 4, animationDelay: `${delay}ms` }} />
      </div>
    </div>
  )
}

/** The matched baseline-vs-trained held-out evaluation, with its provenance. */
export default function RecordedComparison({ comparison: c }: { comparison: EvalComparison }) {
  const d = c.delta
  const dist = c.actionDistribution
  const actions = dist ? Array.from(new Set([...Object.keys(dist.baseline), ...Object.keys(dist.trained)])) : []

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <h3 className="h3">{c.title}</h3>
        <span className="stamp stamp-info">Recorded held-out evaluation</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 20 }}>
        {c.experimentId} · n = {c.n} held-out episodes · difficulty {c.difficulty}
        {c.evalSettings && (
          <>
            {' '}
            · sampled completions (temperature {c.evalSettings.temperature}, majority vote of {c.evalSettings.samples})
          </>
        )}
      </p>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div>
          <p style={LABEL}>Mean F1 (0–1 scale)</p>
          <Bar label="Baseline (untrained Qwen-2.5-1.5B)" value={c.baseline.f1} color="var(--text-3)" delay={100} />
          <Bar label="GRPO trained" value={c.trained.f1} color="var(--accent)" delay={220} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)' }} className="num">
            <span>0</span>
            <span>1</span>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Baseline</th>
                <th>GRPO</th>
                <th>Δ abs</th>
                <th>Δ rel</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Mean F1</td>
                <td className="num">{fmtMetric(c.baseline.f1)}</td>
                <td className="num">{fmtMetric(c.trained.f1)}</td>
                <td className="num" style={{ color: d.f1Abs >= 0 ? 'var(--green)' : 'var(--red)' }} title={`exact: ${fmtExact(d.f1Abs)}`}>
                  {fmtSignedMetric(d.f1Abs)}
                </td>
                <td className="num">{fmtSignedPct(d.f1RelPct)}</td>
              </tr>
              <tr>
                <td>Mean reward</td>
                <td className="num">{fmtMetric(c.baseline.reward)}</td>
                <td className="num">{fmtMetric(c.trained.reward)}</td>
                <td className="num" style={{ color: d.rewardAbs >= 0 ? 'var(--green)' : 'var(--red)' }} title={`exact: ${fmtExact(d.rewardAbs)}`}>
                  {fmtSignedMetric(d.rewardAbs)}
                </td>
                <td className="num">{fmtSignedPct(d.rewardRelPct)}</td>
              </tr>
              {c.baseline.validJsonRate !== null && c.trained.validJsonRate !== null && (
                <tr>
                  <td>Valid-JSON rate</td>
                  <td className="num">{fmtMetric(c.baseline.validJsonRate)}</td>
                  <td className="num">{fmtMetric(c.trained.validJsonRate)}</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {c.perTier.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <p style={LABEL}>Mean F1 by episode tier (small n per tier)</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>n</th>
                  <th>Baseline F1</th>
                  <th>GRPO F1</th>
                </tr>
              </thead>
              <tbody>
                {c.perTier.map((t) => (
                  <tr key={t.tier}>
                    <td>{t.tier}</td>
                    <td className="num">{t.n}</td>
                    <td className="num">{fmtMetric(t.baselineF1)}</td>
                    <td className="num">{fmtMetric(t.trainedF1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dist && (
        <div style={{ marginTop: 22 }}>
          <p style={LABEL}>Final action chosen per episode (counts out of {c.n})</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Baseline</th>
                  <th>GRPO</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a}>
                    <td className="num">{a}</td>
                    <td className="num">{dist.baseline[a] ?? 0}</td>
                    <td className="num">{dist.trained[a] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 18 }}>
        Source: {c.sources.map((s) => `results/${s}`).join(', ')}. Single run; no confidence interval or significance test is recorded for this
        difference. Differences are computed in the browser from those files, not typed in.
      </p>
      {c.warnings.length > 0 && (
        <div className="note-box" style={{ marginTop: 12 }} role="alert">
          <strong>Data consistency warning:</strong> {c.warnings.join('; ')}
        </div>
      )}
    </div>
  )
}
