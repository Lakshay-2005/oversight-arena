/**
 * lib/evaluation.ts
 * The only place that reads, selects, derives and formats recorded experiment results.
 *
 * Source of truth: the committed files under the repo's `results/` directory.
 * scripts/sync-results.mjs copies them into public/results-data/ at dev/build time;
 * the browser fetches them from there. No metric value is hard-coded in this file or
 * in any component.
 *
 * Three kinds of data are kept apart on purpose:
 *   1. recorded held-out evaluations   (this file: EvalComparison)
 *   2. recorded training history       (this file: TrainingHistory)
 *   3. live single-episode telemetry   (store/arenaStore.ts, from the running backend)
 */

export const RESULTS_BASE = '/results-data'

export const RESULT_FILES = {
  baselineEval: 'eval_baseline_summary.json',
  trainedEval: 'eval_grpo_summary.json',
  trainingSummary: 'training_summary.json',
  ablation: 'ablation_summary.json',
  groq: 'eval_groq_summary.json',
  trainingRewards: 'grpo_rewards.csv',
} as const

/** The matched comparison shown as "the" baseline-vs-trained result. Chosen explicitly. */
export const SELECTED_COMPARISON = {
  experimentId: 'run2-fixed-d0.4',
  title: 'GRPO Run 2 — fixed difficulty 0.4',
  difficulty: 0.4,
} as const

const EPS = 1e-9

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TierStats {
  n: number
  meanReward: number
  meanF1: number
}

export interface EvalSlice {
  label: string
  n: number
  meanReward: number
  meanF1: number
  validJsonRate: number | null
  actionDistribution: Record<string, number> | null
  perTier: Record<string, TierStats> | null
}

export interface EvalSummary extends EvalSlice {
  byDifficulty: Record<string, EvalSlice>
}

export interface MetricPair {
  f1: number
  reward: number
  validJsonRate: number | null
}

export interface EvalComparison {
  experimentId: string
  title: string
  difficulty: number
  n: number
  baseline: MetricPair
  trained: MetricPair
  delta: {
    f1Abs: number
    /** Percent, e.g. 5.88 for +5.88%. null when the baseline is 0. */
    f1RelPct: number | null
    rewardAbs: number
    rewardRelPct: number | null
  }
  actionDistribution: { baseline: Record<string, number>; trained: Record<string, number> } | null
  perTier: Array<{ tier: string; n: number; baselineF1: number; trainedF1: number; baselineReward: number; trainedReward: number }>
  /** Decoding settings recorded in training_summary.json, or null if absent. */
  evalSettings: { temperature: number; samples: number } | null
  sources: string[]
  /** Disagreements between the summaries and training_summary.json. Empty when consistent. */
  warnings: string[]
}

export interface TrainingMeta {
  model: string
  epochs: number
  numGenerations: number
  nPrompts: number
  learningRate: number
  klBeta: number
  curriculum: boolean
  nLogRows: number
}

export interface RewardPoint {
  step: number
  reward: number
}

export interface TrainingHistory {
  experimentId: string
  title: string
  points: RewardPoint[]
  stats: { n: number; mean: number; min: number; max: number }
  meta: TrainingMeta
  source: string
  warnings: string[]
}

export interface AblationRow {
  key: 'baseline' | 'grpo_with_guardrails' | 'grpo_without_guardrails'
  label: string
  n: number
  meanReward: number
  meanF1: number
}

export interface OtherExperiments {
  ablation: AblationRow[]
  groq: { label: string; n: number; meanF1: number; meanReward: number; difficulty: number } | null
  sources: string[]
}

export type Section<T> = { ok: true; data: T } | { ok: false; error: string }

export interface ResultsBundle {
  comparison: Section<EvalComparison>
  training: Section<TrainingHistory>
  others: Section<OtherExperiments>
}

// ─── Validation helpers ────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function asObj(v: unknown, what: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what}: expected an object`)
  return v as Obj
}

function finite(o: Obj, key: string, what: string): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${what}: "${key}" must be a finite number`)
  return v
}

function unit(o: Obj, key: string, what: string): number {
  const v = finite(o, key, what)
  if (v < 0 || v > 1) throw new Error(`${what}: "${key}" must be within [0, 1] (got ${v})`)
  return v
}

function posInt(o: Obj, key: string, what: string): number {
  const v = finite(o, key, what)
  if (!Number.isInteger(v) || v <= 0) throw new Error(`${what}: "${key}" must be a positive integer (got ${v})`)
  return v
}

function optUnit(o: Obj, key: string, what: string): number | null {
  return o[key] === undefined || o[key] === null ? null : unit(o, key, what)
}

function parseSlice(raw: unknown, what: string): EvalSlice {
  const o = asObj(raw, what)
  let actionDistribution: Record<string, number> | null = null
  if (o.action_distribution !== undefined) {
    const ad = asObj(o.action_distribution, `${what}.action_distribution`)
    actionDistribution = {}
    for (const k of Object.keys(ad)) actionDistribution[k] = finite(ad, k, `${what}.action_distribution`)
  }
  let perTier: Record<string, TierStats> | null = null
  if (o.per_tier !== undefined) {
    const pt = asObj(o.per_tier, `${what}.per_tier`)
    perTier = {}
    for (const k of Object.keys(pt)) {
      const t = asObj(pt[k], `${what}.per_tier.${k}`)
      perTier[k] = {
        n: posInt(t, 'n', `${what}.per_tier.${k}`),
        meanReward: finite(t, 'mean_reward', `${what}.per_tier.${k}`),
        meanF1: unit(t, 'mean_f1', `${what}.per_tier.${k}`),
      }
    }
  }
  return {
    label: typeof o.label === 'string' ? o.label : '',
    n: posInt(o, 'n', what),
    meanReward: finite(o, 'mean_reward', what),
    meanF1: unit(o, 'mean_f1', what),
    validJsonRate: optUnit(o, 'valid_json_rate', what),
    actionDistribution,
    perTier,
  }
}

export function parseEvalSummary(raw: unknown, what: string): EvalSummary {
  const o = asObj(raw, what)
  const top = parseSlice(o, what)
  const byDifficulty: Record<string, EvalSlice> = {}
  if (o.by_difficulty !== undefined) {
    const bd = asObj(o.by_difficulty, `${what}.by_difficulty`)
    for (const k of Object.keys(bd)) byDifficulty[k] = parseSlice(bd[k], `${what}.by_difficulty[${k}]`)
  }
  return { ...top, byDifficulty }
}

/** Picks the by_difficulty slice for `difficulty`; throws instead of falling back to the pooled numbers. */
export function selectDifficultySlice(summary: EvalSummary, difficulty: number, what: string): EvalSlice {
  const key = Object.keys(summary.byDifficulty).find((k) => Math.abs(parseFloat(k) - difficulty) < EPS)
  if (key === undefined) {
    throw new Error(`${what}: no evaluation recorded at difficulty ${difficulty} (have: ${Object.keys(summary.byDifficulty).join(', ') || 'none'})`)
  }
  return summary.byDifficulty[key]
}

function relPct(from: number, to: number): number | null {
  return Math.abs(from) < EPS ? null : ((to - from) / from) * 100
}

// ─── Comparison ────────────────────────────────────────────────────────────

/**
 * Builds the matched baseline-vs-trained comparison at one explicit difficulty.
 * Refuses to compare slices with different sample counts.
 */
export function buildComparison(
  baselineRaw: unknown,
  trainedRaw: unknown,
  trainingSummaryRaw: unknown | null,
  selection: { experimentId: string; title: string; difficulty: number } = SELECTED_COMPARISON,
): EvalComparison {
  const baselineSummary = parseEvalSummary(baselineRaw, RESULT_FILES.baselineEval)
  const trainedSummary = parseEvalSummary(trainedRaw, RESULT_FILES.trainedEval)
  const base = selectDifficultySlice(baselineSummary, selection.difficulty, RESULT_FILES.baselineEval)
  const trained = selectDifficultySlice(trainedSummary, selection.difficulty, RESULT_FILES.trainedEval)

  if (base.n !== trained.n) {
    throw new Error(`Not a matched comparison: baseline n=${base.n} vs trained n=${trained.n} at difficulty ${selection.difficulty}`)
  }

  const tiers = Object.keys(base.perTier ?? {}).filter((t) => trained.perTier?.[t])
  const perTier = tiers.map((tier) => ({
    tier,
    n: base.perTier![tier].n,
    baselineF1: base.perTier![tier].meanF1,
    trainedF1: trained.perTier![tier].meanF1,
    baselineReward: base.perTier![tier].meanReward,
    trainedReward: trained.perTier![tier].meanReward,
  }))

  const f1Abs = trained.meanF1 - base.meanF1
  const rewardAbs = trained.meanReward - base.meanReward

  const warnings: string[] = []
  let evalSettings: EvalComparison['evalSettings'] = null
  if (trainingSummaryRaw !== null) {
    try {
      const ts = asObj(trainingSummaryRaw, RESULT_FILES.trainingSummary)
      if (typeof ts.eval_temperature === 'number' && typeof ts.eval_samples === 'number') {
        evalSettings = { temperature: ts.eval_temperature, samples: ts.eval_samples }
      }
      const tsBase = selectDifficultySlice(parseEvalSummary(ts.baseline_eval, 'training_summary.baseline_eval'), selection.difficulty, 'training_summary.baseline_eval')
      const tsTrained = selectDifficultySlice(parseEvalSummary(ts.trained_eval, 'training_summary.trained_eval'), selection.difficulty, 'training_summary.trained_eval')
      const check = (name: string, a: number, b: number) => {
        if (Math.abs(a - b) > 1e-6) warnings.push(`${name}: summary file says ${a}, training_summary.json says ${b}`)
      }
      check('baseline mean F1', base.meanF1, tsBase.meanF1)
      check('trained mean F1', trained.meanF1, tsTrained.meanF1)
      check('baseline mean reward', base.meanReward, tsBase.meanReward)
      check('trained mean reward', trained.meanReward, tsTrained.meanReward)
      check('baseline n', base.n, tsBase.n)
      if (typeof ts.delta_f1 === 'number') check('delta F1', f1Abs, ts.delta_f1)
    } catch (err) {
      warnings.push(`training_summary.json could not be cross-checked: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    experimentId: selection.experimentId,
    title: selection.title,
    difficulty: selection.difficulty,
    n: base.n,
    baseline: { f1: base.meanF1, reward: base.meanReward, validJsonRate: base.validJsonRate },
    trained: { f1: trained.meanF1, reward: trained.meanReward, validJsonRate: trained.validJsonRate },
    delta: { f1Abs, f1RelPct: relPct(base.meanF1, trained.meanF1), rewardAbs, rewardRelPct: relPct(base.meanReward, trained.meanReward) },
    actionDistribution:
      base.actionDistribution && trained.actionDistribution
        ? { baseline: base.actionDistribution, trained: trained.actionDistribution }
        : null,
    perTier,
    evalSettings,
    sources: [RESULT_FILES.baselineEval, RESULT_FILES.trainedEval, RESULT_FILES.trainingSummary],
    warnings,
  }
}

// ─── Training history ──────────────────────────────────────────────────────

export function parseRewardCsv(text: string): RewardPoint[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2 || lines[0].trim() !== 'step,reward') {
    throw new Error(`${RESULT_FILES.trainingRewards}: expected header "step,reward"`)
  }
  const points = lines.slice(1).map((line, i) => {
    const [s, r, ...rest] = line.split(',')
    const step = Number(s)
    const reward = Number(r)
    if (rest.length > 0 || s === '' || r === undefined || r === '' || !Number.isFinite(step) || !Number.isFinite(reward)) {
      throw new Error(`${RESULT_FILES.trainingRewards}: invalid row ${i + 2}: "${line}"`)
    }
    return { step, reward }
  })
  for (let i = 1; i < points.length; i++) {
    if (points[i].step <= points[i - 1].step) throw new Error(`${RESULT_FILES.trainingRewards}: steps must strictly increase (row ${i + 2})`)
  }
  return points
}

export function summarizeRewards(points: RewardPoint[]): { n: number; mean: number; min: number; max: number } {
  if (points.length === 0) throw new Error('no reward points')
  let sum = 0
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    sum += p.reward
    min = Math.min(min, p.reward)
    max = Math.max(max, p.reward)
  }
  return { n: points.length, mean: sum / points.length, min, max }
}

/** Trailing moving average; the first `window - 1` points average over what is available. */
export function movingAverage(points: RewardPoint[], window: number): RewardPoint[] {
  if (!Number.isInteger(window) || window < 1) throw new Error('window must be a positive integer')
  return points.map((p, i) => {
    const from = Math.max(0, i - window + 1)
    let sum = 0
    for (let j = from; j <= i; j++) sum += points[j].reward
    return { step: p.step, reward: sum / (i - from + 1) }
  })
}

export function buildTrainingHistory(csvText: string, trainingSummaryRaw: unknown): TrainingHistory {
  const points = parseRewardCsv(csvText)
  const stats = summarizeRewards(points)
  const ts = asObj(trainingSummaryRaw, RESULT_FILES.trainingSummary)
  const meta: TrainingMeta = {
    model: typeof ts.model === 'string' ? ts.model : 'unknown',
    epochs: finite(ts, 'epochs', RESULT_FILES.trainingSummary),
    numGenerations: finite(ts, 'num_generations', RESULT_FILES.trainingSummary),
    nPrompts: finite(ts, 'n_prompts', RESULT_FILES.trainingSummary),
    learningRate: finite(ts, 'lr', RESULT_FILES.trainingSummary),
    klBeta: finite(ts, 'kl_beta', RESULT_FILES.trainingSummary),
    curriculum: ts.curriculum === true,
    nLogRows: finite(ts, 'n_log_rows', RESULT_FILES.trainingSummary),
  }
  const warnings: string[] = []
  if (typeof ts.n_reward_samples === 'number' && ts.n_reward_samples !== stats.n) {
    warnings.push(`${RESULT_FILES.trainingRewards} has ${stats.n} rows but training_summary.json records ${ts.n_reward_samples} reward samples`)
  }
  for (const [name, mine, key] of [['mean', stats.mean, 'mean_reward'], ['min', stats.min, 'min_reward'], ['max', stats.max, 'max_reward']] as const) {
    const theirs = ts[key]
    if (typeof theirs === 'number' && Math.abs(theirs - mine) > 1e-5) {
      warnings.push(`reward ${name}: CSV gives ${mine}, training_summary.json says ${theirs}`)
    }
  }
  return {
    experimentId: SELECTED_COMPARISON.experimentId,
    title: 'GRPO Run 2 — training reward per logged step',
    points,
    stats,
    meta,
    source: `${RESULT_FILES.trainingRewards} (+ ${RESULT_FILES.trainingSummary})`,
    warnings,
  }
}

// ─── Other recorded experiments ────────────────────────────────────────────

export function buildOtherExperiments(ablationRaw: unknown, groqRaw: unknown | null): OtherExperiments {
  const a = asObj(ablationRaw, RESULT_FILES.ablation)
  const rows: AblationRow[] = (['baseline', 'grpo_with_guardrails', 'grpo_without_guardrails'] as const).map((key) => {
    const r = asObj(a[key], `${RESULT_FILES.ablation}.${key}`)
    return {
      key,
      label: typeof r.label === 'string' ? r.label : key,
      n: posInt(r, 'n', `${RESULT_FILES.ablation}.${key}`),
      meanReward: finite(r, 'mean_reward', `${RESULT_FILES.ablation}.${key}`),
      meanF1: unit(r, 'mean_f1', `${RESULT_FILES.ablation}.${key}`),
    }
  })
  let groq: OtherExperiments['groq'] = null
  if (groqRaw !== null) {
    const g = asObj(groqRaw, RESULT_FILES.groq)
    groq = {
      label: typeof g.model === 'string' ? g.model : 'external reference',
      n: posInt(g, 'n', RESULT_FILES.groq),
      meanF1: unit(g, 'mean_f1', RESULT_FILES.groq),
      meanReward: finite(g, 'mean_reward', RESULT_FILES.groq),
      difficulty: finite(g, 'difficulty', RESULT_FILES.groq),
    }
  }
  return { ablation: rows, groq, sources: [RESULT_FILES.ablation, RESULT_FILES.groq] }
}

// ─── Loader ────────────────────────────────────────────────────────────────

function section<T>(fn: () => T): Section<T> {
  try {
    return { ok: true, data: fn() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Loads and validates every recorded result. `readText` returns the file contents for
 * a name from RESULT_FILES; the browser passes a fetch wrapper, tests pass fs reads.
 * A failure in one section does not hide the others.
 */
export async function loadResultsBundle(readText: (file: string) => Promise<string>): Promise<ResultsBundle> {
  const read = async (file: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    try {
      return { ok: true, text: await readText(file) }
    } catch (err) {
      return { ok: false, error: `${file}: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
  const [baseline, trained, summary, ablation, groq, rewards] = await Promise.all(
    [RESULT_FILES.baselineEval, RESULT_FILES.trainedEval, RESULT_FILES.trainingSummary, RESULT_FILES.ablation, RESULT_FILES.groq, RESULT_FILES.trainingRewards].map(read),
  )
  const json = (r: Awaited<ReturnType<typeof read>>, file: string): unknown => {
    if (!r.ok) throw new Error(r.error)
    try {
      return JSON.parse(r.text)
    } catch {
      throw new Error(`${file}: not valid JSON`)
    }
  }
  return {
    comparison: section(() =>
      buildComparison(json(baseline, RESULT_FILES.baselineEval), json(trained, RESULT_FILES.trainedEval), summary.ok ? json(summary, RESULT_FILES.trainingSummary) : null),
    ),
    training: section(() => {
      if (!rewards.ok) throw new Error(rewards.error)
      return buildTrainingHistory(rewards.text, json(summary, RESULT_FILES.trainingSummary))
    }),
    others: section(() => buildOtherExperiments(json(ablation, RESULT_FILES.ablation), groq.ok ? json(groq, RESULT_FILES.groq) : null)),
  }
}

/** Browser loader: fetches the files synced into /results-data. */
export function loadResultsFromNetwork(): Promise<ResultsBundle> {
  return loadResultsBundle(async (file) => {
    const res = await fetch(`${RESULTS_BASE}/${file}`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  })
}

// ─── Formatting ────────────────────────────────────────────────────────────

/** Metric to 3 decimals, e.g. 0.189. */
export const fmtMetric = (v: number): string => round3(v).toFixed(3)

/**
 * Round half away from zero to 3 decimals after stripping float noise, so values that are equal in
 * the source files (0.0875 vs 0.08750000000000005) never display differently (0.087 vs 0.088).
 */
function round3(v: number): number {
  const clean = Number(v.toPrecision(12))
  return (Math.sign(clean) * Math.round(Math.abs(clean) * 1000)) / 1000
}

/** Signed metric to 3 decimals using a real minus sign, e.g. +0.011 / −0.003. */
export const fmtSignedMetric = (v: number): string => `${v < 0 ? '−' : '+'}${Math.abs(round3(v)).toFixed(3)}`

/** Signed percentage to 1 decimal, e.g. +5.9%. null renders as "n/a" (undefined baseline). */
export const fmtSignedPct = (pct: number | null): string =>
  pct === null ? 'n/a' : `${pct < 0 ? '−' : '+'}${Math.abs(pct).toFixed(1)}%`

/** Full precision for tooltips / provenance lines. */
export const fmtExact = (v: number): string => String(Number(v.toPrecision(7)))
