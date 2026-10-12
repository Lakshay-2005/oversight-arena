'use client'

import { create } from 'zustand'
import { AppState, DIFFICULTY_PRESETS, DifficultyPreset, Episode } from '@/types'
import { ApiError, apiGrader, apiHealth, apiReset, apiStep } from '@/lib/api'
import {
  buildDiffLines,
  buildGrade,
  buildWorkers,
  describeOutcome,
  pickFocusWorker,
  runHeuristicPanel,
} from '@/lib/transform'

const RECONNECT_MS = 10_000

let initialized = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
/** Monotonic id so a slow, superseded request can never overwrite newer state. */
let requestSeq = 0

function describeError(err: unknown): { kind: 'offline' | 'error'; message: string } {
  if (err instanceof ApiError) {
    return err.kind === 'network'
      ? { kind: 'offline', message: err.message }
      : { kind: 'error', message: err.message }
  }
  return { kind: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
}

/**
 * One live episode:
 *   1. POST /reset at the preset's difficulty
 *   2. scripted heuristic panel scores the observation (no ground truth is passed to it)
 *   3. POST /step with the panel's own decision (flag its chosen worker, or accept_all)
 *   4. GET /grader to grade that decision against environment ground truth
 * Everything produced here is single-episode telemetry, not an evaluation result.
 */
async function loadEpisode(preset: DifficultyPreset): Promise<Episode> {
  const difficulty = DIFFICULTY_PRESETS[preset].difficulty
  // The server's default seed is fixed (OVERSIGHT_SEED=0), so a seedless /reset would return the
  // same episode every time. Send a fresh seed so "New episode" is actually new; it is shown in the UI.
  const seed = Math.floor(Math.random() * 1_000_000_000)
  const { observation, state } = await apiReset(seed, difficulty)

  const panel = runHeuristicPanel(observation)
  const { decision } = panel

  await apiStep(
    decision.action === 'flag_worker'
      ? {
          action: 'flag_worker',
          worker_id: decision.worker as string,
          reasoning: `Scripted heuristic panel majority (${decision.flagVotes}/${decision.totalVotes} FLAG). Not an LLM.`,
        }
      : { action: 'accept_all', reasoning: 'Scripted heuristic panel: fewer than 2 FLAG votes. Not an LLM.' },
  )
  const grader = await apiGrader()

  const focusWorker = pickFocusWorker(decision, observation.workers, panel.workerScores)
  return {
    episodeId: state.episode_id,
    seed,
    difficulty: state.difficulty,
    preset,
    maxTurns: state.max_turns,
    workers: buildWorkers(observation, state.malicious_workers, state.worker_pattern_ids),
    reviewers: panel.reviewers,
    votes: panel.votes,
    decision,
    workerScores: panel.workerScores,
    focusWorker,
    diffLines: buildDiffLines(observation, focusWorker),
    groundTruthMalicious: grader.malicious_workers,
    grade: buildGrade(grader),
    outcome: describeOutcome(decision, grader),
  }
}

function scheduleReconnect(fn: () => void) {
  if (reconnectTimer !== null) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(fn, RECONNECT_MS)
  // Node (tests) only: do not keep the process alive for a pending reconnect. Browsers return a number.
  ;(reconnectTimer as unknown as { unref?: () => void }).unref?.()
}

export const useArenaStore = create<AppState>((set, get) => ({
  connection: 'connecting',
  connectionMessage: null,
  episodeStatus: 'idle',
  episodeError: null,
  preset: 'low',
  episode: null,

  init: () => {
    if (initialized || typeof window === 'undefined') return
    initialized = true
    void get().retry()
  },

  retry: async () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const seq = ++requestSeq
    set({ connection: 'connecting', connectionMessage: null })
    try {
      await apiHealth()
    } catch (err) {
      if (seq !== requestSeq) return
      const { kind, message } = describeError(err)
      set({ connection: kind, connectionMessage: message })
      scheduleReconnect(() => void get().retry())
      return
    }
    if (seq !== requestSeq) return
    set({ connection: 'online', connectionMessage: null })
    await get().runEpisode()
  },

  runEpisode: async (preset) => {
    const chosen = preset ?? get().preset
    const seq = ++requestSeq
    set({ preset: chosen, episodeStatus: 'loading', episodeError: null })
    try {
      const episode = await loadEpisode(chosen)
      if (seq !== requestSeq) return
      set({ episode, episodeStatus: 'ready', connection: 'online', connectionMessage: null })
    } catch (err) {
      if (seq !== requestSeq) return
      const { kind, message } = describeError(err)
      // Keep nothing from the failed attempt: a stale episode would look like current data.
      set({
        episode: null,
        episodeStatus: 'error',
        episodeError: message,
        connection: kind === 'offline' ? 'offline' : 'error',
        connectionMessage: message,
      })
      if (kind === 'offline') scheduleReconnect(() => void get().retry())
    }
  },
}))
