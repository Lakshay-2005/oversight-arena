/**
 * lib/contracts.ts
 * Backend response shapes and runtime validators.
 *
 * Every parser throws a ShapeError naming the endpoint and the offending field.
 * Nothing is defaulted: a missing worker list, diff or F1 is an error the UI must
 * surface, never a plausible-looking placeholder.
 */

export class ShapeError extends Error {
  constructor(where: string, detail: string) {
    super(`Unexpected ${where} response: ${detail}`)
    this.name = 'ShapeError'
  }
}

// ─── Shapes ────────────────────────────────────────────────────────────────

export interface BackendObservation {
  turn: number
  workers: string[]
  focused_patch_diff: string
  message: string
  reward: number
  done: boolean
}

export interface BackendState {
  episode_id: string
  step_count: number
  max_turns: number
  done: boolean
  workers: string[]
  /** Environment ground truth. Not something a reviewer could observe. */
  malicious_workers: string[]
  flagged_workers: string[]
  rejected_workers: string[]
  action_history: string[]
  cumulative_reward: number
  terminal_reward: number | null
  difficulty: number
  worker_pattern_ids: string[]
  malicious_pattern_ids: string[]
  malicious_tier: string
}

export interface BackendResetResponse {
  observation: BackendObservation
  state: BackendState
}

export interface BackendStepResponse {
  observation: BackendObservation
  reward: number
  done: boolean
  state: BackendState
}

export interface BackendGraderResponse {
  metric: string
  success: boolean
  /** Terminal reward when done, otherwise the mean per-step reward so far. */
  reward: number
  /** Episode F1 for this single episode. */
  f1: number
  precision: number
  recall: number
  tp: number
  fp: number
  fn: number
  malicious_workers: string[]
  flagged_workers: string[]
  step_count: number
  done: boolean
  guardrails_triggered: string[]
  malicious_tier: string
}

export interface OverseerActionPayload {
  action: 'flag_worker' | 'accept_all' | 'inspect_patch' | 'reject_patch' | 'request_resubmit'
  worker_id?: string
  reasoning?: string
  cwe_tag?: string
  suspicion_scores?: Record<string, number>
}

// ─── Primitive checks ──────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function obj(v: unknown, where: string, field: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new ShapeError(where, `"${field}" must be an object`)
  }
  return v as Obj
}

function num(o: Obj, key: string, where: string): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ShapeError(where, `"${key}" must be a finite number (got ${JSON.stringify(v)})`)
  }
  return v
}

function int(o: Obj, key: string, where: string): number {
  const v = num(o, key, where)
  if (!Number.isInteger(v) || v < 0) {
    throw new ShapeError(where, `"${key}" must be a non-negative integer (got ${v})`)
  }
  return v
}

function bool(o: Obj, key: string, where: string): boolean {
  const v = o[key]
  if (typeof v !== 'boolean') throw new ShapeError(where, `"${key}" must be a boolean`)
  return v
}

function str(o: Obj, key: string, where: string, allowEmpty = true): string {
  const v = o[key]
  if (typeof v !== 'string' || (!allowEmpty && v.length === 0)) {
    throw new ShapeError(where, `"${key}" must be a${allowEmpty ? '' : ' non-empty'} string`)
  }
  return v
}

function strList(o: Obj, key: string, where: string, nonEmpty = false): string[] {
  const v = o[key]
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
    throw new ShapeError(where, `"${key}" must be an array of strings`)
  }
  if (nonEmpty && v.length === 0) throw new ShapeError(where, `"${key}" must not be empty`)
  return v as string[]
}

// ─── Parsers ───────────────────────────────────────────────────────────────

export function parseObservation(raw: unknown, where = 'observation'): BackendObservation {
  const o = obj(raw, where, 'observation')
  return {
    turn: int(o, 'turn', where),
    workers: strList(o, 'workers', where, true),
    focused_patch_diff: str(o, 'focused_patch_diff', where, false),
    message: str(o, 'message', where),
    reward: num(o, 'reward', where),
    done: bool(o, 'done', where),
  }
}

export function parseState(raw: unknown, where = 'state'): BackendState {
  const o = obj(raw, where, 'state')
  let terminal: number | null = null
  if (o.terminal_reward !== null && o.terminal_reward !== undefined) {
    terminal = num(o, 'terminal_reward', where)
  }
  return {
    episode_id: str(o, 'episode_id', where, false),
    step_count: int(o, 'step_count', where),
    max_turns: int(o, 'max_turns', where),
    done: bool(o, 'done', where),
    workers: strList(o, 'workers', where, true),
    malicious_workers: strList(o, 'malicious_workers', where),
    flagged_workers: strList(o, 'flagged_workers', where),
    rejected_workers: strList(o, 'rejected_workers', where),
    action_history: strList(o, 'action_history', where),
    cumulative_reward: num(o, 'cumulative_reward', where),
    terminal_reward: terminal,
    difficulty: num(o, 'difficulty', where),
    worker_pattern_ids: strList(o, 'worker_pattern_ids', where),
    malicious_pattern_ids: strList(o, 'malicious_pattern_ids', where),
    malicious_tier: str(o, 'malicious_tier', where),
  }
}

export function parseResetResponse(raw: unknown): BackendResetResponse {
  const o = obj(raw, '/reset', 'body')
  return {
    observation: parseObservation(o.observation, '/reset observation'),
    state: parseState(o.state, '/reset state'),
  }
}

export function parseStepResponse(raw: unknown): BackendStepResponse {
  const o = obj(raw, '/step', 'body')
  return {
    observation: parseObservation(o.observation, '/step observation'),
    reward: num(o, 'reward', '/step'),
    done: bool(o, 'done', '/step'),
    state: parseState(o.state, '/step state'),
  }
}

export function parseGrader(raw: unknown): BackendGraderResponse {
  const where = '/grader'
  const o = obj(raw, where, 'body')
  const f1 = num(o, 'f1', where)
  if (f1 < 0 || f1 > 1) throw new ShapeError(where, `"f1" must be within [0, 1] (got ${f1})`)
  return {
    metric: str(o, 'metric', where),
    success: bool(o, 'success', where),
    reward: num(o, 'reward', where),
    f1,
    precision: num(o, 'precision', where),
    recall: num(o, 'recall', where),
    tp: int(o, 'tp', where),
    fp: int(o, 'fp', where),
    fn: int(o, 'fn', where),
    malicious_workers: strList(o, 'malicious_workers', where),
    flagged_workers: strList(o, 'flagged_workers', where),
    step_count: int(o, 'step_count', where),
    done: bool(o, 'done', where),
    guardrails_triggered: strList(o, 'guardrails_triggered', where),
    malicious_tier: str(o, 'malicious_tier', where),
  }
}

export function parseHealth(raw: unknown): { status: string } {
  const o = obj(raw, '/health', 'body')
  return { status: str(o, 'status', '/health', false) }
}
