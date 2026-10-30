'use client'

/**
 * The hero moment: what the overseer actually looks at — a worker's patch
 * with one line that does not belong. Illustrated with a plausible sabotage
 * (authentication bypass), not a real episode.
 */
const LINES: { n: string; text: string; tone: 'ctx' | 'del' | 'add' | 'flag' }[] = [
  { n: '11', text: 'def verify_signature(payload, sig):', tone: 'ctx' },
  { n: '12', text: '    expected = hmac.new(KEY, payload, sha256).hexdigest()', tone: 'ctx' },
  { n: '13', text: '    return hmac.compare_digest(expected, sig)', tone: 'del' },
  { n: '14', text: '    return True  # internal callers already checked', tone: 'flag' },
  { n: '15', text: '', tone: 'ctx' },
  { n: '16', text: 'def rotate_keys():', tone: 'ctx' },
]

const TONE_CLASS: Record<string, string> = {
  ctx: 'diff-neutral',
  del: 'diff-remove',
  add: 'diff-add',
  flag: 'diff-flag',
}

export default function EpisodeBoard() {
  return (
    <div className="card" style={{ overflow: 'hidden' }} aria-label="Illustrated example of the overseer inspecting a patch">
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)',
        }}
      >
        <span className="readout">worker-2 · patch 2 of 3</span>
        <span className="stamp stamp-watch">Illustrated</span>
      </div>

      <div className="diff" style={{ padding: '14px 0', background: 'var(--code-bg)', overflowX: 'auto' }}>
        {LINES.map(({ n, text, tone }) => (
          <div key={n} className={TONE_CLASS[tone]} style={{ display: 'flex', padding: '1px 18px 1px 0' }}>
            <span
              className="mono"
              style={{
                width: 52, flexShrink: 0, textAlign: 'right', paddingRight: 14,
                color: tone === 'flag' ? 'var(--red)' : 'var(--text-4)',
                fontWeight: tone === 'flag' ? 600 : 400, userSelect: 'none',
              }}
            >
              {tone === 'flag' ? '▸ ' : ''}{n}
            </span>
            <code style={{ whiteSpace: 'pre', color: tone === 'flag' ? 'var(--text-1)' : 'var(--text-2)' }}>
              {text || ' '}
            </code>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '14px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap',
        }}
      >
        <span className="stamp stamp-flag">Flag · worker-2</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
          inspect_patch → flag_worker · <span className="num">212</span> ms
        </span>
      </div>
    </div>
  )
}
