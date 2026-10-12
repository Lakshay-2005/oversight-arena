import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RESULT_FILES,
  SELECTED_COMPARISON,
  buildComparison,
  buildOtherExperiments,
  buildTrainingHistory,
  fmtExact,
  fmtMetric,
  fmtSignedMetric,
  fmtSignedPct,
  loadResultsBundle,
  movingAverage,
  parseEvalSummary,
  parseRewardCsv,
  selectDifficultySlice,
  summarizeRewards,
} from '../lib/evaluation'

const here = dirname(fileURLToPath(import.meta.url))
const RESULTS = resolve(here, '..', '..', 'results')
const REPO = resolve(here, '..', '..')
// Bundle files: 'docs/<name>' are the Markdown docs synced from the repo (README.md, blog.md, docs/judge_qa.md).
const DOC_PATHS: Record<string, string> = { 'docs/README.md': 'README.md', 'docs/blog.md': 'blog.md', 'docs/judge_qa.md': 'docs/judge_qa.md' }
const readText = (f: string) => readFileSync(DOC_PATHS[f] ? join(REPO, DOC_PATHS[f]) : join(RESULTS, f), 'utf8')
const readJson = (f: string): Record<string, any> => JSON.parse(readText(f))

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`)

// ─── The known Run 2 comparison, checked against the raw JSON on disk ──────

test('Run 2 comparison equals the committed summaries (not hand-typed values)', () => {
  const c = buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), readJson(RESULT_FILES.trainingSummary))
  const b = readJson(RESULT_FILES.baselineEval).by_difficulty['0.4']
  const g = readJson(RESULT_FILES.trainedEval).by_difficulty['0.4']

  assert.equal(c.baseline.f1, b.mean_f1)
  assert.equal(c.trained.f1, g.mean_f1)
  assert.equal(c.baseline.reward, b.mean_reward)
  assert.equal(c.trained.reward, g.mean_reward)
  assert.equal(c.n, b.n)
  assert.equal(c.n, g.n)
  assert.equal(c.difficulty, 0.4)
  assert.equal(c.experimentId, SELECTED_COMPARISON.experimentId)
  assert.deepEqual(c.warnings, [], 'summaries must agree with training_summary.json')
})

test('Run 2 known numbers: n=30, F1 0.1889 -> 0.2000, +0.0111 abs, +5.9% rel', () => {
  const c = buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), null)
  assert.equal(c.n, 30)
  close(c.baseline.f1, 0.1888889, 1e-6)
  close(c.trained.f1, 0.2, 1e-12)
  close(c.baseline.reward, 0.0694444, 1e-6)
  close(c.trained.reward, 0.0666667, 1e-6)
  close(c.delta.f1Abs, 0.0111111, 1e-6)
  close(c.delta.f1RelPct!, 5.882353, 1e-5)
  close(c.delta.rewardAbs, -0.0027778, 1e-6)
  // The old hard-coded UI claims must not be reproducible from this data.
  assert.notEqual(fmtMetric(c.baseline.f1), '0.420')
  assert.notEqual(fmtMetric(c.trained.f1), '0.710')
  assert.ok(Math.abs(c.delta.f1Abs - 0.29) > 0.2)
  assert.ok(Math.abs((c.delta.f1RelPct ?? 0) - 37) > 20)
})

test('delta F1 matches training_summary.json delta_f1', () => {
  const c = buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), null)
  close(c.delta.f1Abs, readJson(RESULT_FILES.trainingSummary).delta_f1, 1e-9)
})

test('per-tier rows and action distribution come from the files', () => {
  const c = buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), null)
  assert.deepEqual(c.perTier.map((t) => t.tier).sort(), ['T1', 'T2', 'T3', 'honest'])
  assert.equal(c.perTier.reduce((s, t) => s + t.n, 0), c.n)
  assert.equal(c.actionDistribution!.baseline.inspect_patch, 4)
  assert.equal(c.actionDistribution!.trained.inspect_patch, 8)
})

// ─── Selection safety ──────────────────────────────────────────────────────

test('comparison refuses mismatched sample counts', () => {
  const base = readJson(RESULT_FILES.baselineEval)
  const trained = structuredClone(readJson(RESULT_FILES.trainedEval))
  trained.by_difficulty['0.4'].n = 20
  assert.throws(() => buildComparison(base, trained, null), /Not a matched comparison/)
})

test('selecting a difficulty that was not evaluated throws instead of using pooled numbers', () => {
  const s = parseEvalSummary(readJson(RESULT_FILES.baselineEval), 'baseline')
  assert.throws(() => selectDifficultySlice(s, 0.5, 'baseline'), /no evaluation recorded at difficulty 0.5/)
  assert.throws(
    () => buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), null, { experimentId: 'x', title: 'x', difficulty: 0.7 }),
    /difficulty 0.7/,
  )
})

test('summary without by_difficulty is rejected for a difficulty-specific comparison', () => {
  const flat = { label: 'x', n: 30, mean_reward: 0.1, mean_f1: 0.2 }
  assert.throws(() => buildComparison(flat, flat, null), /no evaluation recorded/)
})

test('malformed summaries are rejected, never defaulted to zero', () => {
  const ok = readJson(RESULT_FILES.baselineEval)
  for (const mutate of [
    (o: any) => delete o.by_difficulty['0.4'].mean_f1,
    (o: any) => (o.by_difficulty['0.4'].mean_f1 = 'abc'),
    (o: any) => (o.by_difficulty['0.4'].mean_f1 = 1.4),
    (o: any) => (o.by_difficulty['0.4'].mean_reward = null),
    (o: any) => (o.by_difficulty['0.4'].n = 0),
    (o: any) => (o.by_difficulty['0.4'].n = 2.5),
  ]) {
    const bad = structuredClone(ok)
    mutate(bad)
    assert.throws(() => buildComparison(bad, readJson(RESULT_FILES.trainedEval), null), Error)
  }
  assert.throws(() => parseEvalSummary(null, 'x'), /expected an object/)
})

test('cross-check surfaces a disagreement with training_summary.json', () => {
  const ts = structuredClone(readJson(RESULT_FILES.trainingSummary))
  ts.trained_eval.by_difficulty['0.4'].mean_f1 = 0.5
  const c = buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), ts)
  assert.ok(c.warnings.some((w) => w.includes('trained mean F1')))
})

test('relative change is null (not Infinity/NaN) when the baseline is zero', () => {
  const mk = (f1: number) => ({ label: 'x', n: 10, mean_reward: 0, mean_f1: f1, by_difficulty: { '0.4': { n: 10, mean_reward: 0, mean_f1: f1 } } })
  const c = buildComparison(mk(0), mk(0.3), null)
  assert.equal(c.delta.f1RelPct, null)
  assert.equal(fmtSignedPct(c.delta.f1RelPct), 'n/a')
})

// ─── Formatting ────────────────────────────────────────────────────────────

test('formatting keeps sign and precision honest', () => {
  assert.equal(fmtMetric(0.2), '0.200')
  assert.equal(fmtMetric(0.18888888888888886), '0.189')
  assert.equal(fmtSignedMetric(0.011111111), '+0.011')
  assert.equal(fmtSignedMetric(-0.0027777), '−0.003')
  assert.equal(fmtSignedPct(5.882353), '+5.9%')
  assert.equal(fmtSignedPct(-2.5), '−2.5%')
  assert.equal(fmtExact(0.18888888888888886), '0.1888889')
  // values equal in results/ablation_summary.json must print identically
  assert.equal(fmtMetric(0.0875), fmtMetric(0.08750000000000005))
  assert.equal(fmtMetric(-0.0875), '-0.088')
  assert.equal(fmtSignedMetric(0), '+0.000')
})

// ─── Training history ──────────────────────────────────────────────────────

test('training history parses grpo_rewards.csv and agrees with training_summary.json', () => {
  const h = buildTrainingHistory(readText(RESULT_FILES.trainingRewards), readJson(RESULT_FILES.trainingSummary))
  const ts = readJson(RESULT_FILES.trainingSummary)
  assert.equal(h.points.length, ts.n_reward_samples)
  assert.equal(h.points[0].step, 1)
  close(h.stats.mean, ts.mean_reward, 1e-6)
  close(h.stats.min, ts.min_reward, 1e-6)
  close(h.stats.max, ts.max_reward, 1e-6)
  assert.ok(h.stats.min < 0, 'negative rewards must survive (old chart clipped to [0,1])')
  assert.deepEqual(h.warnings, [])
  assert.equal(h.meta.model, ts.model)
  assert.equal(h.meta.epochs, ts.epochs)
})

test('reward CSV parser rejects malformed input', () => {
  assert.throws(() => parseRewardCsv('a,b\n1,2'), /header/)
  assert.throws(() => parseRewardCsv('step,reward\n1,abc'), /invalid row 2/)
  assert.throws(() => parseRewardCsv('step,reward\n1,'), /invalid row 2/)
  assert.throws(() => parseRewardCsv('step,reward\n1,0.1\n1,0.2'), /strictly increase/)
  assert.throws(() => parseRewardCsv('step,reward\n1,0.1,9'), /invalid row 2/)
  assert.deepEqual(parseRewardCsv('step,reward\r\n1,0.5\r\n2,-0.25\r\n'), [{ step: 1, reward: 0.5 }, { step: 2, reward: -0.25 }])
})

test('moving average and summary', () => {
  const pts = [1, 2, 3, 4].map((r, i) => ({ step: i + 1, reward: r }))
  assert.deepEqual(movingAverage(pts, 2).map((p) => p.reward), [1, 1.5, 2.5, 3.5])
  assert.deepEqual(summarizeRewards(pts), { n: 4, mean: 2.5, min: 1, max: 4 })
  assert.throws(() => summarizeRewards([]), /no reward points/)
  assert.throws(() => movingAverage(pts, 0), /positive integer/)
})

// ─── Other experiments stay separate ───────────────────────────────────────

test('ablation and Groq reference are read from their own files with their own n', () => {
  const o = buildOtherExperiments(readJson(RESULT_FILES.ablation), readJson(RESULT_FILES.groq))
  assert.deepEqual(o.ablation.map((r) => r.n), [20, 20, 20])
  assert.equal(o.groq!.n, 20)
  assert.equal(o.groq!.difficulty, 0.5)
  const run2 = buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), null)
  assert.notEqual(o.ablation[0].meanF1, run2.baseline.f1, 'ablation baseline is a different experiment than Run 2')
})

// ─── Bundle loader + deployment wiring ─────────────────────────────────────

test('bundle loads every section from the real files', async () => {
  const b = await loadResultsBundle(async (f) => readText(f))
  assert.ok(b.documented.ok && b.comparison.ok && b.training.ok && b.others.ok)
})

test('a missing/invalid file fails only its own section', async () => {
  const b = await loadResultsBundle(async (f) => {
    if (f === RESULT_FILES.trainedEval) throw new Error('HTTP 404')
    if (f === RESULT_FILES.ablation) return '{ not json'
    return readText(f)
  })
  assert.equal(b.comparison.ok, false)
  if (!b.comparison.ok) assert.match(b.comparison.error, /eval_grpo_summary\.json: HTTP 404/)
  assert.equal(b.others.ok, false)
  if (!b.others.ok) assert.match(b.others.error, /not valid JSON/)
  assert.equal(b.training.ok, true)
})

test('decoding settings come from training_summary.json when present', () => {
  const ts = readJson(RESULT_FILES.trainingSummary)
  const c = buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), ts)
  assert.deepEqual(c.evalSettings, { temperature: ts.eval_temperature, samples: ts.eval_samples })
  assert.equal(buildComparison(readJson(RESULT_FILES.baselineEval), readJson(RESULT_FILES.trainedEval), null).evalSettings, null)
})

test('sync script and RESULT_FILES list the same files, and all exist in results/', () => {
  const script = readFileSync(join(here, '..', 'scripts', 'sync-results.mjs'), 'utf8')
  const block = /SYNCED_FILES = \[([\s\S]*?)\]/.exec(script)
  assert.ok(block, 'SYNCED_FILES list not found in sync-results.mjs')
  const synced = (block[1].match(/'[^']+'/g) ?? []).map((q) => q.slice(1, -1)).sort()
  const expected = Object.values(RESULT_FILES).sort()
  assert.deepEqual(synced, expected)
  for (const f of expected) assert.ok(existsSync(join(RESULTS, f)), `${f} missing from results/`)
})
