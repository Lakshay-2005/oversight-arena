import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DOC_FILES, parseDocumentedBest } from '../lib/documented'
import { RESULT_FILES, buildComparison, fmtMetric, loadResultsBundle } from '../lib/evaluation'

// tsx compiles the project's JSX (tsconfig "jsx": "preserve") with the classic transform, which needs React in scope.
;(globalThis as { React?: unknown }).React = React
const loadComponents = async () => ({
  BestResultHero: (await import('../components/BestResultHero')).default,
  RecordedComparison: (await import('../components/RecordedComparison')).default,
})

const here = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(here, '..', '..')
const RESULTS = join(REPO, 'results')
const doc = (rel: string) => readFileSync(join(REPO, rel), 'utf8')
const readme = () => doc('README.md')
const blog = () => doc('blog.md')
const judge = () => doc('docs/judge_qa.md')
const json = (f: string) => JSON.parse(readFileSync(join(RESULTS, f), 'utf8'))

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`)
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

// ─── Run 1: documentation-reported best result ─────────────────────────────

test('Run 1 headline is parsed from the README: 0.189 -> 0.244, +29%, best run', () => {
  const d = parseDocumentedBest(readme(), blog(), judge())
  assert.equal(d.title, 'GRPO Run 1')
  assert.equal(d.trainedF1, 0.244)
  assert.equal(d.baselineF1, 0.189)
  assert.equal(d.reportedRelPct, 29)
  assert.match(d.readmeNote, /best/i)
  assert.match(d.setup, /curriculum/)
  assert.equal(d.evalSeeds, 30)
  assert.equal(d.evalDifficulty, 0.4)
  assert.match(d.source, /README/)
  close(d.impliedRelPct, 29.1005, 1e-3) // 0.244 / 0.189 - 1: consistent with the README's +29%
})

test('the documentation discrepancy is detected: blog.md and judge_qa.md use baseline 0.178', () => {
  const d = parseDocumentedBest(readme(), blog(), judge())
  assert.equal(d.alternateBaselines.length, 1)
  const alt = d.alternateBaselines[0]
  assert.equal(alt.baselineF1, 0.178)
  assert.equal(alt.trainedF1, 0.244)
  assert.deepEqual(alt.sources.sort(), ['blog.md', 'docs/judge_qa.md'])
  close(alt.impliedRelPct, 37.0787, 1e-3) // so those docs' printed +29% does not match their own baseline
  assert.notEqual(Math.round(alt.impliedRelPct), alt.reportedRelPct)
  assert.deepEqual(d.warnings, [])
})

test('the docs say Run 1 raw files are not committed, and results/ really has none', () => {
  const d = parseDocumentedBest(readme(), blog(), judge())
  assert.match(d.rawFilesStatement ?? '', /not fully committed/)
  // 0.244 must not be present in any committed evaluation artifact (nothing to measure Run 1 from).
  for (const f of readdirSync(RESULTS).filter((n) => /^eval_.*\.(json|csv)$|^training_summary|^ablation/.test(n))) {
    assert.ok(!readFileSync(join(RESULTS, f), 'utf8').includes('0.244'), `${f} unexpectedly contains 0.244`)
  }
})

test('parsing fails loudly if the README table changes, and degrades gracefully for the cross-reference docs', () => {
  assert.throws(() => parseDocumentedBest('| nothing |', null, null), /Untrained/)
  assert.throws(() => parseDocumentedBest(readme().replace('**GRPO Run 1**', '**GRPO Run X**'), null, null), /GRPO Run 1/)
  assert.throws(() => parseDocumentedBest(readme().replace('**0.244 (+29%)**', '**1.7 (+29%)**'), null, null), /valid numbers/)
  const bare = parseDocumentedBest(readme(), null, null)
  assert.equal(bare.alternateBaselines.length, 0)
  assert.equal(bare.rawFilesStatement, null)
  const noRow = parseDocumentedBest(readme(), '# no table here', null)
  assert.ok(noRow.warnings.some((w) => w.startsWith('blog.md')))
})

test('a disagreement on the trained value between docs is surfaced, not hidden', () => {
  const d = parseDocumentedBest(readme(), blog().replace('**0.244**', '**0.250**'), judge())
  assert.ok(d.warnings.some((w) => w.includes('0.25') && w.includes('0.244')))
})

test('CRLF checkouts parse identically', () => {
  const d = parseDocumentedBest(readme().replace(/\r?\n/g, '\r\n'), blog().replace(/\r?\n/g, '\r\n'), judge().replace(/\r?\n/g, '\r\n'))
  assert.equal(d.trainedF1, 0.244)
  assert.equal(d.alternateBaselines.length, 1)
})

// ─── Run 1 and Run 2 stay distinct ─────────────────────────────────────────

test('Run 1 (documented 0.244) and Run 2 (committed 0.200) are different experiments with different values', async () => {
  const bundle = await loadResultsBundle(async (f) => {
    const m = /^docs\/(.+)$/.exec(f)
    if (m) return doc(m[1] === 'judge_qa.md' ? 'docs/judge_qa.md' : m[1])
    return readFileSync(join(RESULTS, f), 'utf8')
  })
  assert.ok(bundle.documented.ok && bundle.comparison.ok)
  if (!bundle.documented.ok || !bundle.comparison.ok) return
  const run1 = bundle.documented.data
  const run2 = bundle.comparison.data
  assert.notEqual(run1.experimentId, run2.experimentId)
  assert.equal(fmtMetric(run1.trainedF1), '0.244')
  assert.equal(fmtMetric(run2.trained.f1), '0.200')
  assert.equal(fmtMetric(run1.baselineF1), '0.189')
  assert.equal(fmtMetric(run2.baseline.f1), '0.189')
  // Run 2 is still derived from the JSON, untouched by the documented figure.
  const g = json(RESULT_FILES.trainedEval).by_difficulty['0.4']
  assert.equal(run2.trained.f1, g.mean_f1)
  close(run2.delta.f1Abs, 0.0111111, 1e-6)
  close(run2.delta.f1RelPct!, 5.882353, 1e-5)
  assert.equal(run2.n, 30)
  assert.equal(run2.difficulty, 0.4)
  // Run 1 carries no measured fields to be confused with Run 2's.
  for (const k of ['reward', 'perTier', 'actionDistribution', 'n', 'delta']) assert.ok(!(k in run1), `Run 1 must not have "${k}"`)
})

test('a missing README fails only the documented section; Run 2 is unaffected', async () => {
  const bundle = await loadResultsBundle(async (f) => {
    if (f.startsWith('docs/')) throw new Error('HTTP 404')
    return readFileSync(join(RESULTS, f), 'utf8')
  })
  assert.equal(bundle.documented.ok, false)
  if (!bundle.documented.ok) assert.match(bundle.documented.error, /README\.md: HTTP 404/)
  assert.ok(bundle.comparison.ok && bundle.training.ok && bundle.others.ok)
})

test('optional docs missing: the headline still loads, without the discrepancy note', async () => {
  const bundle = await loadResultsBundle(async (f) => {
    if (f === `docs/${DOC_FILES.blog}` || f === `docs/${DOC_FILES.judgeQa}`) throw new Error('HTTP 404')
    if (f === `docs/${DOC_FILES.readme}`) return readme()
    return readFileSync(join(RESULTS, f), 'utf8')
  })
  assert.ok(bundle.documented.ok)
  if (bundle.documented.ok) assert.equal(bundle.documented.data.alternateBaselines.length, 0)
})

// ─── What the page actually renders ────────────────────────────────────────

test('headline renders 0.244 as GRPO Run 1, documentation-reported, with baseline 0.189 and the discrepancy', async () => {
  const { BestResultHero } = await loadComponents()
  const html = renderToStaticMarkup(createElement(BestResultHero, { best: parseDocumentedBest(readme(), blog(), judge()) }))
  const t = text(html)
  assert.match(t, /Best trained F1/)
  assert.match(t, /GRPO Run 1/)
  assert.ok(t.includes('0.244'))
  assert.ok(t.includes('0.189'))
  assert.match(t, /\+29%/)
  assert.match(t, /Documentation-reported/)
  assert.match(t, /README\.md \(Results table\)/)
  assert.match(t, /not fully committed/)
  assert.match(t, /0\.178/)
  assert.match(t, /\+37\.1%/)
  assert.ok(!t.includes('0.200'), 'the Run 2 value must not appear in the Run 1 headline')
  assert.ok(!/Run 2/.test(t.replace('Run 2, directly below', '')), 'Run 1 headline does not borrow Run 2 data')
})

test('Run 2 card still renders 0.189 -> 0.200, +0.011, +5.9%, n=30, difficulty 0.4, and no Run 1 figure', async () => {
  const { RecordedComparison } = await loadComponents()
  const c = buildComparison(json(RESULT_FILES.baselineEval), json(RESULT_FILES.trainedEval), json(RESULT_FILES.trainingSummary))
  const t = text(renderToStaticMarkup(createElement(RecordedComparison, { comparison: c })))
  assert.ok(t.includes('0.189') && t.includes('0.200'))
  assert.ok(t.includes('+0.011') && t.includes('+5.9%'))
  assert.match(t, /n = 30/)
  assert.match(t, /difficulty 0\.4/)
  assert.match(t, /Run 2/)
  assert.ok(!t.includes('0.244'), 'the documented Run 1 value must not leak into the Run 2 card')
})

test('sync script copies exactly the docs the loader reads', () => {
  const script = readFileSync(join(here, '..', 'scripts', 'sync-results.mjs'), 'utf8')
  const block = /SYNCED_DOCS = \[([\s\S]*?)\n\]/.exec(script)
  assert.ok(block, 'SYNCED_DOCS not found')
  const names = (block[1].match(/\['([^']+)'/g) ?? []).map((m) => m.slice(2, -1)).sort()
  assert.deepEqual(names, Object.values(DOC_FILES).sort())
  const paths = (block[1].match(/, '([^']+)', (true|false)\]/g) ?? []).map((m) => /'([^']+)'/.exec(m)![1])
  for (const p of paths) assert.ok(readFileSync(join(REPO, p), 'utf8').length > 0, `${p} missing`)
})
