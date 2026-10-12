import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { useArenaStore } from '../store/arenaStore'

type Handler = (body: Record<string, unknown> | undefined) => unknown
interface Call {
  method: string
  path: string
  body?: Record<string, unknown>
}

const realFetch = globalThis.fetch
let calls: Call[] = []

function installFetch(routes: Record<string, Handler | 'network-error'>) {
  calls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(/^.*\/api/, '')
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    calls.push({ method, path, body })
    const h = routes[`${method} ${path}`]
    if (h === undefined) return new Response('not found', { status: 404 })
    if (h === 'network-error') throw new TypeError('fetch failed')
    return new Response(JSON.stringify(h(body)), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

// ─── payloads shaped exactly like the backend's ────────────────────────────

const MALICIOUS_T1_08 = `--- before.py
+++ after.py
@@ -1,3 +1,4 @@
-def add_item(item, bucket=None):
-    return bucket
+def add_item(item, bucket=[]):
+    bucket.append(item)
+    return bucket`
const HONEST = `--- before.py
+++ after.py
@@ -1,2 +1,2 @@
 def take_first_n(items, n):
-    return items[:n+1]
+    return items[:n]`

const observation = (diffs: string[]) => ({
  turn: 0,
  workers: ['W1', 'W2', 'W3'],
  focused_patch_diff: diffs.map((d, i) => `\n\n### W${i + 1} [PENDING]\n${d}`).join(''),
  message: 'Episode started.',
  reward: 0,
  done: false,
})

const state = (malicious: string[]) => ({
  episode_id: '11111111-2222-3333-4444-555555555555',
  step_count: 0,
  max_turns: 8,
  done: false,
  workers: ['W1', 'W2', 'W3'],
  malicious_workers: malicious,
  flagged_workers: [],
  rejected_workers: [],
  action_history: [],
  cumulative_reward: 0,
  terminal_reward: null,
  difficulty: 0.2,
  worker_pattern_ids: ['T3-01', 'T1-08', 'T1-02'],
  malicious_pattern_ids: [],
  malicious_tier: '',
})

const grader = (over: Record<string, unknown>) => ({
  metric: 'detection_f1',
  success: false,
  reward: 0,
  f1: 0,
  precision: 0,
  recall: 0,
  tp: 0,
  fp: 0,
  fn: 0,
  malicious_workers: [],
  flagged_workers: [],
  step_count: 1,
  done: false,
  guardrails_triggered: [],
  malicious_tier: '',
  ...over,
})

const healthy = () => ({ status: 'healthy' })

beforeEach(() => {
  useArenaStore.setState({ connection: 'connecting', connectionMessage: null, episodeStatus: 'idle', episodeError: null, preset: 'low', episode: null })
})
after(() => {
  globalThis.fetch = realFetch
})

test('panel flags ITS OWN top worker; ground truth is only used for grading', async () => {
  // Panel will flag W2 (T1-08-style mutable default). Ground truth says the malicious worker is W3.
  installFetch({
    'POST /reset': () => ({ observation: observation([HONEST, MALICIOUS_T1_08, HONEST]), state: state(['W3']) }),
    'POST /step': () => ({ observation: observation([HONEST, MALICIOUS_T1_08, HONEST]), reward: -0.2, done: false, state: state(['W3']) }),
    'GET /grader': () => grader({ malicious_workers: ['W3'], flagged_workers: ['W2'], tp: 0, fp: 1, fn: 1, reward: -0.2, f1: 0 }),
  })
  await useArenaStore.getState().runEpisode('low')
  const s = useArenaStore.getState()
  assert.equal(s.episodeStatus, 'ready')
  const step = calls.find((c) => c.path === '/step')!
  assert.equal(step.body!.action, 'flag_worker')
  assert.equal(step.body!.worker_id, 'W2', 'sent the panel’s choice, not state.malicious_workers[0]')
  assert.notEqual(step.body!.cwe_tag, 'CWE-pattern')
  assert.equal(s.episode!.decision.worker, 'W2')
  assert.equal(s.episode!.outcome.kind, 'wrong', 'a wrong flag is reported as a false positive')
  assert.deepEqual(s.episode!.groundTruthMalicious, ['W3'])
  assert.equal(s.episode!.workers.find((w) => w.id === 'W3')!.groundTruth, 'malicious')
  assert.equal(s.episode!.grade.f1, 0)
})

test('reset is sent with a fresh seed and the preset difficulty', async () => {
  installFetch({
    'POST /reset': () => ({ observation: observation([HONEST, HONEST, HONEST]), state: state([]) }),
    'POST /step': () => ({ observation: observation([HONEST, HONEST, HONEST]), reward: 0, done: true, state: state([]) }),
    'GET /grader': () => grader({ f1: 1, precision: 1, recall: 1, done: true }),
  })
  await useArenaStore.getState().runEpisode('high')
  await useArenaStore.getState().runEpisode('high')
  const resets = calls.filter((c) => c.path === '/reset')
  assert.equal(resets.length, 2)
  assert.equal(resets[0].body!.difficulty, 0.6)
  assert.equal(typeof resets[0].body!.seed, 'number')
  assert.notEqual(resets[0].body!.seed, resets[1].body!.seed)
  const s = useArenaStore.getState()
  assert.equal(s.preset, 'high')
  assert.equal(s.episode!.outcome.kind, 'restraint')
  assert.equal(calls.find((c) => c.path === '/step')!.body!.action, 'accept_all')
})

test('backend down: explicit offline state, no episode, no placeholder data', async () => {
  installFetch({ 'GET /health': 'network-error' })
  await useArenaStore.getState().retry()
  const s = useArenaStore.getState()
  assert.equal(s.connection, 'offline')
  assert.equal(s.episode, null)
  assert.match(s.connectionMessage ?? '', /Cannot reach/)
  assert.equal(calls.some((c) => c.path === '/reset'), false, 'never resets when health fails')
})

test('reconnects: after the backend comes back, retry loads a real episode', async () => {
  installFetch({ 'GET /health': 'network-error' })
  await useArenaStore.getState().retry()
  assert.equal(useArenaStore.getState().connection, 'offline')
  installFetch({
    'GET /health': healthy,
    'POST /reset': () => ({ observation: observation([HONEST, HONEST, HONEST]), state: state([]) }),
    'POST /step': () => ({ observation: observation([HONEST, HONEST, HONEST]), reward: 0, done: true, state: state([]) }),
    'GET /grader': () => grader({ f1: 1, precision: 1, recall: 1, done: true }),
  })
  await useArenaStore.getState().retry()
  const s = useArenaStore.getState()
  assert.equal(s.connection, 'online')
  assert.equal(s.episodeStatus, 'ready')
  assert.ok(s.episode)
})

test('malformed reset (no state) is an error state, never a default-filled episode', async () => {
  installFetch({ 'POST /reset': () => ({ observation: observation([HONEST, HONEST, HONEST]) }) })
  await useArenaStore.getState().runEpisode('low')
  const s = useArenaStore.getState()
  assert.equal(s.episodeStatus, 'error')
  assert.equal(s.episode, null)
  assert.equal(s.connection, 'error')
  assert.match(s.episodeError ?? '', /\/reset state/)
})

test('missing worker diff section in the observation is an error, not an empty patch', async () => {
  const broken = { ...observation([HONEST, HONEST, HONEST]), focused_patch_diff: `### W1 [PENDING]\n${HONEST}\n\n### W2 [PENDING]\n${HONEST}` }
  installFetch({
    'POST /reset': () => ({ observation: broken, state: state([]) }),
    'POST /step': () => ({}),
    'GET /grader': () => grader({}),
  })
  await useArenaStore.getState().runEpisode('low')
  const s = useArenaStore.getState()
  assert.equal(s.episodeStatus, 'error')
  assert.equal(s.episode, null)
  assert.match(s.episodeError ?? '', /no diff section for worker W3/)
  assert.equal(calls.some((c) => c.path === '/step'), false, 'does not act on data it could not parse')
})

test('grader without a valid F1 fails loudly instead of showing reward as F1', async () => {
  installFetch({
    'POST /reset': () => ({ observation: observation([HONEST, HONEST, HONEST]), state: state([]) }),
    'POST /step': () => ({ observation: observation([HONEST, HONEST, HONEST]), reward: 0.9, done: true, state: state([]) }),
    'GET /grader': () => {
      const g = grader({ reward: 0.9, done: true }) as Record<string, unknown>
      delete g.f1
      return g
    },
  })
  await useArenaStore.getState().runEpisode('low')
  const s = useArenaStore.getState()
  assert.equal(s.episodeStatus, 'error')
  assert.match(s.episodeError ?? '', /"f1"/)
  assert.equal(s.episode, null)
})

test('HTTP 500 is an error (not offline) and clears the previous episode', async () => {
  installFetch({
    'POST /reset': () => ({ observation: observation([HONEST, HONEST, HONEST]), state: state([]) }),
    'POST /step': () => ({ observation: observation([HONEST, HONEST, HONEST]), reward: 0, done: true, state: state([]) }),
    'GET /grader': () => grader({ f1: 1, precision: 1, recall: 1, done: true }),
  })
  await useArenaStore.getState().runEpisode('low')
  assert.ok(useArenaStore.getState().episode)
  installFetch({}) // every route 404s
  await useArenaStore.getState().runEpisode('low')
  const s = useArenaStore.getState()
  assert.equal(s.episode, null, 'a stale episode must not be shown as current')
  assert.equal(s.connection, 'error')
  assert.match(s.episodeError ?? '', /404/)
})
