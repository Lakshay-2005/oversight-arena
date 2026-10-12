// types/index.ts

/**
 * Live-episode difficulty presets. These only change the difficulty passed to POST /reset.
 * They are NOT "baseline model" vs "trained model": no model runs in the browser.
 */
export type DifficultyPreset = 'low' | 'high'

export const DIFFICULTY_PRESETS: Record<DifficultyPreset, { label: string; difficulty: number }> = {
  low: { label: 'Low', difficulty: 0.2 },
  high: { label: 'High', difficulty: 0.6 },
}

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'error'
export type EpisodeStatus = 'idle' | 'loading' | 'ready' | 'error'

/** What the environment says about a worker. Ground truth, not a reviewer verdict. */
export type GroundTruth = 'malicious' | 'honest'

export interface Worker {
  id: string
  label: string
  /** Environment ground truth for this episode (hidden from real overseers). */
  groundTruth: GroundTruth
  /** Catalog pattern id from the environment, e.g. "T1-01". */
  patternId: string | null
  /** CWE tag only if it literally appears in the diff text; otherwise undefined. */
  cwe?: string
  patch: string
}

export type ReviewerAction = 'FLAG' | 'PASS'

/** One scripted, rule-based reviewer. Not an LLM, not a model call. */
export interface ReviewerState {
  id: string
  label: string
  profile: string
  threshold: number
  scores: Record<string, number>
  topWorker: string
  topScore: number
  action: ReviewerAction
  matchedRules: Record<string, string[]>
  rationale: string
}

export interface Vote {
  reviewerId: string
  action: ReviewerAction
  /** Worker this reviewer would flag; null for PASS. */
  target: string | null
}

export interface PanelDecision {
  action: 'flag_worker' | 'accept_all'
  worker: string | null
  flagVotes: number
  totalVotes: number
}

export type DiffLineType = 'header' | 'add' | 'remove' | 'bug' | 'neutral'

export interface DiffLine {
  type: DiffLineType
  text: string
}

export interface EpisodeGrade {
  /** null if the backend returned no valid F1. Never substituted with reward. */
  f1: number | null
  precision: number
  recall: number
  tp: number
  fp: number
  fn: number
  /** Terminal reward if done, otherwise the backend's running mean of per-step rewards. */
  reward: number
  done: boolean
  stepCount: number
  guardrails: string[]
}

export interface Episode {
  episodeId: string
  /** Seed sent to POST /reset, so the episode can be reproduced. */
  seed: number
  difficulty: number
  preset: DifficultyPreset
  maxTurns: number
  workers: Worker[]
  reviewers: ReviewerState[]
  votes: Vote[]
  decision: PanelDecision
  /** Mean rule score per worker across the panel. */
  workerScores: Record<string, number>
  focusWorker: string
  diffLines: DiffLine[]
  groundTruthMalicious: string[]
  grade: EpisodeGrade
  outcome: { kind: 'correct' | 'wrong' | 'missed' | 'restraint'; text: string }
}

export interface AppState {
  connection: ConnectionStatus
  connectionMessage: string | null
  episodeStatus: EpisodeStatus
  episodeError: string | null
  preset: DifficultyPreset
  episode: Episode | null

  /** Idempotent: starts the first health check + episode load and the reconnect loop. */
  init: () => void
  /** Re-check the backend now (and load an episode if it is reachable). */
  retry: () => Promise<void>
  /** Reset the backend episode (optionally at another preset) and run the heuristic panel on it. */
  runEpisode: (preset?: DifficultyPreset) => Promise<void>
}
