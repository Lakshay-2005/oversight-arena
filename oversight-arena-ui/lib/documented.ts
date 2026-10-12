/**
 * lib/documented.ts
 * Extracts the DOCUMENTATION-REPORTED best result (GRPO Run 1) from the repository's own docs.
 *
 * Run 1's raw evaluation files are not committed (docs/judge_qa.md, "known limitations"), so this is
 * NOT a measured, reproducible result in `results/`. It is what the README headline table states,
 * cross-referenced against blog.md and docs/judge_qa.md. Nothing here is hard-coded: the numbers are
 * parsed from the Markdown copied into the export by scripts/sync-results.mjs, so editing the docs
 * changes the dashboard and a test fails if the docs stop being parseable.
 *
 * Nothing about Run 1 beyond what the docs print is derived: no reward, no action distribution.
 */

export const DOC_FILES = {
  readme: 'README.md',
  blog: 'blog.md',
  judgeQa: 'judge_qa.md',
} as const

export interface AlternateBaseline {
  baselineF1: number
  trainedF1: number
  reportedRelPct: number
  /** Relative gain implied by this source's own baseline and trained values. */
  impliedRelPct: number
  sources: string[]
}

export interface DocumentedBest {
  experimentId: string
  title: string
  /** README wording for the run, e.g. "curriculum d=0.2–0.6, 96 prompts". */
  setup: string
  /** README note column for the run (e.g. "best run"). */
  readmeNote: string
  baselineF1: number
  trainedF1: number
  /** Relative improvement exactly as printed by the README (e.g. 29). */
  reportedRelPct: number
  /** Relative gain implied by the README's own baseline and trained values. */
  impliedRelPct: number
  evalSeeds: number | null
  evalDifficulty: number | null
  source: string
  /** Other docs that give a different baseline for Run 1. */
  alternateBaselines: AlternateBaseline[]
  /** Docs say the raw evaluation files for this run are not committed (judge_qa limitations). */
  rawFilesStatement: string | null
  warnings: string[]
}

const num = (s: string): number => Number(s)
const normalize = (text: string): string => text.replace(/\r\n/g, '\n')
const implied = (base: number, trained: number): number => ((trained - base) / base) * 100

/** Table rows differ per document, so each gets its own pattern. All return [baseline, trained, pct]. */
const BLOG_ROW = /^\|\s*Run 1\s*\|[^|\n]*\|\s*([0-9.]+)\s*\|\s*\*\*([0-9.]+)\*\*\s*\|\s*\*\*\+?(\d+)%\*\*/m
const JUDGE_ROW = /^\|\s*Run 1 \([^)\n]*\)\s*\|[^|\n]*\|\s*([0-9.]+)\s*\|\s*\*\*([0-9.]+)\*\*\s*\|\s*\*\*\+?(\d+)%\*\*/m

export function parseDocumentedBest(readmeRaw: string, blogRaw: string | null, judgeRaw: string | null): DocumentedBest {
  const readme = normalize(readmeRaw)

  const base = /^\|\s*Untrained[^|\n]*\|\s*([0-9.]+)\s*\|/m.exec(readme)
  if (!base) throw new Error('README.md: could not find the "Untrained …" row of the Results table')
  const run1 = /^\|\s*\*\*GRPO Run 1\*\*\s*[—–-]\s*([^|\n]*?)\s*\|\s*\*\*([0-9.]+)\s*\(\+(\d+)%\)\*\*\s*\|[^|\n]*\|\s*([^|\n]*?)\s*\|/m.exec(readme)
  if (!run1) throw new Error('README.md: could not find the "GRPO Run 1" row of the Results table')

  const baselineF1 = num(base[1])
  const trainedF1 = num(run1[2])
  const warnings: string[] = []
  if (![baselineF1, trainedF1].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
    throw new Error('README.md: Run 1 F1 values are not valid numbers in [0, 1]')
  }

  const seeds = /Evaluated on (\d+) disjoint held-out seeds/.exec(readme)
  const diff = /^###\s*F1 at d=([0-9.]+)/m.exec(readme)

  const alt = new Map<string, AlternateBaseline>()
  const consider = (m: RegExpExecArray | null, source: string) => {
    if (!m) {
      warnings.push(`${source}: could not find its Run 1 row, so its baseline was not cross-checked`)
      return
    }
    const b = num(m[1])
    const t = num(m[2])
    if (Math.abs(t - trainedF1) > 1e-9) warnings.push(`${source} reports Run 1 trained F1 ${t}, README reports ${trainedF1}`)
    if (Math.abs(b - baselineF1) < 1e-9) return
    const key = String(b)
    const entry = alt.get(key) ?? { baselineF1: b, trainedF1: t, reportedRelPct: num(m[3]), impliedRelPct: implied(b, t), sources: [] }
    entry.sources.push(source)
    alt.set(key, entry)
  }
  if (blogRaw !== null) consider(BLOG_ROW.exec(normalize(blogRaw)), 'blog.md')
  if (judgeRaw !== null) consider(JUDGE_ROW.exec(normalize(judgeRaw)), 'docs/judge_qa.md')

  let rawFilesStatement: string | null = null
  if (judgeRaw !== null) {
    const line = normalize(judgeRaw).split('\n').find((l) => /Run 1[^\n]*not fully committed/.test(l))
    if (line) rawFilesStatement = 'docs/judge_qa.md (known limitations): Run 1 results files were not fully committed; its number comes from a separate run’s eval output captured in logs.'
  }

  return {
    experimentId: 'run1-curriculum-documented',
    title: 'GRPO Run 1',
    setup: run1[1],
    readmeNote: run1[4],
    baselineF1,
    trainedF1,
    reportedRelPct: num(run1[3]),
    impliedRelPct: implied(baselineF1, trainedF1),
    evalSeeds: seeds ? Number(seeds[1]) : null,
    evalDifficulty: diff ? Number(diff[1]) : null,
    source: 'README.md (Results table)',
    alternateBaselines: Array.from(alt.values()),
    rawFilesStatement,
    warnings,
  }
}
