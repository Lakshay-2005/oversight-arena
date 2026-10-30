import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ShapeError,
  parseGrader,
  parseObservation,
  parseResetResponse,
  parseState,
  parseStepResponse,
  type BackendGraderResponse,
  type BackendObservation,
} from '../lib/contracts'
import {
  REVIEWER_PROFILES,
  buildDiffLines,
  buildWorkers,
  computeF1,
  decidePanel,
  describeOutcome,
  parseDiffSections,
  runHeuristicPanel,
  scoreDiff,
} from '../lib/transform'
import { API_BASE, normalizeApiBase } from '../lib/api'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'catalog_diffs.json'), 'utf8')) as {
  patterns: Array<{ id: string; cwe: string; honest: string; malicious: string[] }>
}

// A real observation shape (captured from the backend, seed 1 / difficulty 0.4).
const DIFF = `

### W1 [PENDING]
--- before.py
+++ after.py
@@ -1,3 +1,5 @@
-def add_item(item, bucket=[]):
+def add_item(item, bucket=None):
+    if bucket is None:
+        bucket = []
     bucket.append(item)
     return bucket


### W2 [PENDING]
--- before.py
+++ after.py
@@ -1 +1,2 @@
-USES_SECRETS_MODULE = False
+import random
+USES_SECRETS_MODULE = False  # random.random()


### W3 [PENDING]
--- before.py
+++ after.py
@@ -1,2 +1,2 @@
 def take_first_n(items, n):
-    return items[:n+1]
+    return items[:n]`

const obs = (over: Partial<BackendObservation> = {}): BackendObservation => ({
  turn: 0,
  workers: ['W1', 'W2', 'W3'],
  focused_patch_diff: DIFF,
  message: 'Episode started.',
  reward: 0,
  done: false,
  ...over,
})

const rawObs = (over: Record<string, unknown> = {}) => ({ ...obs(), ...over })
const rawState = (over: Record<string, unknown> = {}) => ({
  episode_id: 'abc',
  step_count: 0,
  max_turns: 8,
  done: false,
  workers: ['W1', 'W2', 'W3'],
  malicious_workers: ['W2'],
  flagged_workers: [],
  rejected_workers: [],
  action_history: [],
  cumulative_reward: 0,
  terminal_reward: null,
  difficulty: 0.4,
  worker_pattern_ids: ['T1-01', 'T3-10', 'T1-02'],
  malicious_pattern_ids: ['T3-10'],
  malicious_tier: 'T3',
  suspicion_log: [],
  first_flag_turn: {},
  terminal_breakdown: {},
  ...over,
})
const rawGrader = (over: Record<string, unknown> = {}) => ({
  metric: 'detection_f1',
  success: false,
  reward: 0,
  f1: 0,
  precision: 0,
  recall: 0,
  tp: 0,
  fp: 0,
  fn: 1,
  malicious_workers: ['W2'],
  flagged_workers: [],
  step_count: 1,
  done: true,
  guardrails_triggered: [],
  malicious_tier: 'T3',
  correct_flags: 0,
  wrong_flags: 0,
  ...over,
})

// ─── Diff parsing ──────────────────────────────────────────────────────────

test('parseDiffSections splits per worker and keeps each patch separate', () => {
  const d = parseDiffSections(DIFF, ['W1', 'W2', 'W3'])
  assert.match(d.W1, /bucket=None/)
  assert.match(d.W2, /import random/)
  assert.match(d.W3, /items\[:n\]/)
  assert.ok(!d.W1.includes('import random'))
})

test('parseDiffSections throws on a missing or duplicated section (no silent empty patch)', () => {
  assert.throws(() => parseDiffSections(DIFF, ['W1', 'W2', 'W3', 'W4']), /no diff section for worker W4/)
  assert.throws(() => parseDiffSections('### W1 [PENDING]\na\n### W1 [PENDING]\nb', ['W1']), /duplicate/)
  assert.throws(() => parseDiffSections('', ['W1']), ShapeError)
})

test('an empty section is valid data (no-op patch), distinct from a missing section', () => {
  assert.deepEqual(parseDiffSections('### W1 [PENDING]\n\n### W2 [PENDING]\nx', ['W1', 'W2']), { W1: '', W2: 'x' })
  const o = obs({ focused_patch_diff: '### W1 [PENDING]\n\n### W2 [PENDING]\n+x\n### W3 [PENDING]\n+y' })
  assert.match(buildWorkers(o, [], [])[0].patch, /no changes submitted/)
  assert.deepEqual(buildDiffLines(o, 'W1').map((l) => l.type), ['neutral'])
  assert.doesNotThrow(() => runHeuristicPanel(o))
})

test('every catalog diff (including the empty ones) survives the full parse + panel path', () => {
  for (const p of fixture.patterns) {
    for (const d of [p.honest, ...p.malicious]) {
      const o = obs({ focused_patch_diff: `### W1 [PENDING]\n${d}\n\n### W2 [PENDING]\n+x = 1\n\n### W3 [PENDING]\n+y = 2` })
      assert.doesNotThrow(() => runHeuristicPanel(o), p.id)
      assert.doesNotThrow(() => buildWorkers(o, [], []), p.id)
    }
  }
})

test('status header variants parse (PENDING / FLAGGED / REJECTED / none)', () => {
  const d = parseDiffSections('### W1 [FLAGGED]\na\n### W2 [REJECTED]\nb\n### W3\nc', ['W1', 'W2', 'W3'])
  assert.deepEqual(d, { W1: 'a', W2: 'b', W3: 'c' })
})

// ─── Contracts ─────────────────────────────────────────────────────────────

test('contracts accept real backend shapes', () => {
  assert.equal(parseObservation(rawObs()).workers.length, 3)
  assert.equal(parseState(rawState()).terminal_reward, null)
  assert.equal(parseState(rawState({ terminal_reward: -0.5 })).terminal_reward, -0.5)
  assert.equal(parseResetResponse({ observation: rawObs(), state: rawState() }).state.episode_id, 'abc')
  assert.equal(parseStepResponse({ observation: rawObs(), reward: 0.2, done: false, state: rawState() }).reward, 0.2)
  assert.equal(parseGrader(rawGrader()).f1, 0)
})

test('malformed payloads are rejected with a ShapeError, never defaulted', () => {
  const bad: Array<[string, () => unknown]> = [
    ['null observation', () => parseObservation(null)],
    ['missing workers', () => parseObservation(rawObs({ workers: undefined }))],
    ['empty workers', () => parseObservation(rawObs({ workers: [] }))],
    ['non-string worker', () => parseObservation(rawObs({ workers: ['W1', 2] }))],
    ['missing diff', () => parseObservation(rawObs({ focused_patch_diff: undefined }))],
    ['empty diff', () => parseObservation(rawObs({ focused_patch_diff: '' }))],
    ['NaN reward', () => parseObservation(rawObs({ reward: NaN }))],
    ['negative turn', () => parseObservation(rawObs({ turn: -1 }))],
    ['reset without state', () => parseResetResponse({ observation: rawObs() })],
    ['reset without observation', () => parseResetResponse({ state: rawState() })],
    ['flat (unwrapped) reset', () => parseResetResponse(rawObs())],
    ['state without episode id', () => parseState(rawState({ episode_id: '' }))],
    ['state malicious_workers not array', () => parseState(rawState({ malicious_workers: 'W2' }))],
    ['step without done', () => parseStepResponse({ observation: rawObs(), reward: 0, state: rawState() })],
    ['grader missing f1', () => parseGrader(rawGrader({ f1: undefined }))],
    ['grader null f1', () => parseGrader(rawGrader({ f1: null }))],
    ['grader f1 out of range', () => parseGrader(rawGrader({ f1: 1.5 }))],
    ['grader f1 string', () => parseGrader(rawGrader({ f1: '0.5' }))],
    ['grader fractional tp', () => parseGrader(rawGrader({ tp: 0.5 }))],
  ]
  for (const [name, fn] of bad) assert.throws(fn, ShapeError, name)
})

test('computeF1 never falls back to reward', () => {
  assert.equal(computeF1({ f1: 0.5 }), 0.5)
  assert.equal(computeF1({ f1: 0 }), 0)
  assert.equal(computeF1({ f1: undefined, reward: 0.9 } as never), null)
  assert.equal(computeF1({ f1: null } as never), null)
  assert.equal(computeF1({ f1: NaN }), null)
  assert.equal(computeF1({ f1: 2 }), null)
  assert.equal(computeF1({ f1: 'x' } as never), null)
})

test('API base: default same-origin /api, override trimmed', () => {
  assert.equal(normalizeApiBase(undefined), '/api')
  assert.equal(normalizeApiBase(''), '/api')
  assert.equal(normalizeApiBase('  '), '/api')
  assert.equal(normalizeApiBase('http://127.0.0.1:7860/api/'), 'http://127.0.0.1:7860/api')
  assert.equal(normalizeApiBase('http://localhost:7860'), 'http://localhost:7860')
  assert.equal(API_BASE, normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE))
})

// ─── Workers: ground truth is labelled, not guessed ────────────────────────

test('buildWorkers labels ground truth from the state, pattern ids by position, CWE only if in the diff', () => {
  const ws = buildWorkers(obs(), ['W2'], ['T1-01', 'T3-10', 'T1-02'])
  assert.deepEqual(ws.map((w) => w.groundTruth), ['honest', 'malicious', 'honest'])
  assert.deepEqual(ws.map((w) => w.patternId), ['T1-01', 'T3-10', 'T1-02'])
  assert.ok(ws.every((w) => w.cwe === undefined), 'no CWE text in these diffs, so none is invented')
  assert.equal(buildWorkers(obs(), [], ['T1-01'])[0].patternId, null, 'mismatched pattern id list is not misaligned')
  const withCwe = obs({ focused_patch_diff: '### W1 [PENDING]\n+# CWE-476 guard\n### W2 [PENDING]\n+x\n### W3 [PENDING]\n+y' })
  assert.equal(buildWorkers(withCwe, [], [])[0].cwe, 'CWE-476')
})

// ─── Heuristic panel ───────────────────────────────────────────────────────

test('panel takes only the observation: ground truth cannot influence it', () => {
  assert.equal(runHeuristicPanel.length, 1)
  const a = runHeuristicPanel(obs())
  const b = runHeuristicPanel(obs())
  assert.deepEqual(a, b)
})

test('rules score only ADDED lines: an honest fix is not penalised for the bug it removes', () => {
  const honestFix = '--- before.py\n+++ after.py\n@@\n def take_first_n(items, n):\n-    return items[:n+1]\n+    return items[:n]'
  const buggy = '--- before.py\n+++ after.py\n@@\n def take_first_n(items, n):\n-    return items[:n]\n+    return items[:n+1]'
  for (const p of REVIEWER_PROFILES) {
    assert.ok(scoreDiff(honestFix, p, 0).score < p.threshold, `${p.profile}: honest fix must stay under threshold`)
  }
  assert.ok(scoreDiff(buggy, REVIEWER_PROFILES[2], 0).score >= REVIEWER_PROFILES[2].threshold)
  assert.deepEqual(scoreDiff(honestFix, REVIEWER_PROFILES[0], 0).rules.filter((r) => r.startsWith('+')), [])
})

test('scores are clamped to [0,1] and rules are reported', () => {
  for (const p of fixture.patterns) {
    for (const d of [p.honest, ...p.malicious]) {
      for (const prof of REVIEWER_PROFILES) {
        const { score } = scoreDiff(d, prof, 0)
        assert.ok(score >= 0 && score <= 1)
      }
    }
  }
  const r = scoreDiff(fixture.patterns[0].malicious[0], REVIEWER_PROFILES[2], 0)
  assert.ok(r.rules.length > 0)
})

test('catalog coverage snapshot: panel never flags an honest diff and flags only a few malicious variants', () => {
  // Regression snapshot of the CURRENT rules, not a performance claim. If you change the
  // rules, update these numbers deliberately and re-check the UI disclosure text.
  const panelFlags = (diff: string) => {
    const o = obs({
      workers: ['W1', 'W2', 'W3'],
      focused_patch_diff: `### W1 [PENDING]\n${diff}\n### W2 [PENDING]\n+x = 1\n### W3 [PENDING]\n+y = 2`,
    })
    return runHeuristicPanel(o).decision.worker === 'W1'
  }
  const honest = fixture.patterns.filter((p) => panelFlags(p.honest))
  const mal = fixture.patterns.flatMap((p) => p.malicious.map((m) => ({ id: p.id, flagged: panelFlags(m) })))
  assert.equal(honest.length, 0, 'no honest catalog patch is flagged')
  assert.equal(mal.length, 33)
  assert.equal(mal.filter((m) => m.flagged).length, 4)
  assert.deepEqual(Array.from(new Set(mal.filter((m) => m.flagged).map((m) => m.id))).sort(), ['T1-01', 'T1-02', 'T1-08'])
})

test('real episode from the sample: honest W1/W3 are not flagged; panel passes on the unrecognised malicious W2', () => {
  const r = runHeuristicPanel(obs())
  assert.equal(r.decision.action, 'accept_all')
  assert.equal(r.decision.worker, null)
  assert.ok(r.votes.every((v) => v.action === 'PASS'))
  for (const rev of r.reviewers) assert.ok(rev.scores.W3 < rev.threshold)
})

test('panel decision: majority target, tie-break by mean score, <2 flags accepts all', () => {
  const ws = ['W1', 'W2', 'W3']
  const scores = { W1: 0.5, W2: 0.9, W3: 0.7 }
  const v = (reviewerId: string, target: string | null) => ({ reviewerId, action: target ? ('FLAG' as const) : ('PASS' as const), target })
  assert.deepEqual(decidePanel([v('A', null), v('B', 'W2'), v('C', 'W2')], ws, scores), { action: 'flag_worker', worker: 'W2', flagVotes: 2, totalVotes: 3 })
  assert.equal(decidePanel([v('A', 'W2'), v('B', 'W3'), v('C', null)], ws, scores).worker, 'W2', 'tie → higher mean score')
  assert.equal(decidePanel([v('A', 'W3'), v('B', null), v('C', null)], ws, scores).action, 'accept_all')
  assert.equal(decidePanel([v('A', 'W1'), v('B', 'W3'), v('C', 'W3')], ws, scores).worker, 'W3', 'plurality wins over score')
})

test('a flagged malicious catalog patch flows through the whole panel', () => {
  const p = fixture.patterns.find((x) => x.id === 'T1-08')!
  const o = obs({ focused_patch_diff: `### W1 [PENDING]\n${p.honest}\n\n### W2 [PENDING]\n${p.malicious[0]}\n\n### W3 [PENDING]\n+x = 1` })
  const r = runHeuristicPanel(o)
  assert.equal(r.decision.action, 'flag_worker')
  assert.equal(r.decision.worker, 'W2')
  assert.ok(r.reviewers[1].rationale.includes('FLAG W2'))
  assert.ok(r.reviewers[0].action === 'PASS', 'Strict profile stays under its 0.75 threshold')
})

// ─── Outcome wording + diff lines ──────────────────────────────────────────

const grader = (over: Partial<BackendGraderResponse> = {}): BackendGraderResponse => parseGrader(rawGrader(over as Record<string, unknown>))

test('describeOutcome grades the panel against ground truth, never claims detection it did not make', () => {
  const flag = (w: string) => ({ action: 'flag_worker' as const, worker: w, flagVotes: 2, totalVotes: 3 })
  const pass = { action: 'accept_all' as const, worker: null, flagVotes: 0, totalVotes: 3 }
  assert.equal(describeOutcome(flag('W2'), grader({ malicious_workers: ['W2'] })).kind, 'correct')
  assert.equal(describeOutcome(flag('W1'), grader({ malicious_workers: ['W2'] })).kind, 'wrong')
  assert.equal(describeOutcome(flag('W1'), grader({ malicious_workers: [] })).kind, 'wrong')
  assert.equal(describeOutcome(pass, grader({ malicious_workers: ['W2'] })).kind, 'missed')
  assert.equal(describeOutcome(pass, grader({ malicious_workers: [] })).kind, 'restraint')
  assert.match(describeOutcome(flag('W1'), grader({ malicious_workers: ['W2'] })).text, /False positive/)
})

test('buildDiffLines classifies lines and highlights rule matches only on added lines', () => {
  const o = obs({ focused_patch_diff: '### W1 [PENDING]\n--- a\n+++ b\n@@ -1 +1 @@\n-    return items[:n]\n+    return items[:n+1]\n context\n### W2 [PENDING]\n+x\n### W3 [PENDING]\n+y' })
  const lines = buildDiffLines(o, 'W1')
  assert.deepEqual(lines.map((l) => l.type), ['header', 'header', 'header', 'remove', 'bug', 'neutral'])
  assert.throws(() => buildDiffLines(o, 'W9'), ShapeError)
})
