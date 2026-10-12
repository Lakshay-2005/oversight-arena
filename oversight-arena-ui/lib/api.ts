/**
 * lib/api.ts
 * HTTP client for the Oversight Arena FastAPI backend.
 *
 * Base URL:
 *   - default "/api": same origin. In the Docker image / HF Space, FastAPI serves
 *     this static export AND the /api/* aliases, so no configuration is needed.
 *   - NEXT_PUBLIC_API_BASE overrides it for `npm run dev` (Next's static-export
 *     dev server has no proxy), e.g. http://127.0.0.1:7860/api. The backend
 *     allows cross-origin requests. The value is inlined at build time.
 *
 * Every response is validated by lib/contracts.ts before it reaches the store.
 */

import {
  parseGrader,
  parseHealth,
  parseResetResponse,
  parseState,
  parseStepResponse,
  type BackendGraderResponse,
  type BackendResetResponse,
  type BackendState,
  type BackendStepResponse,
  type OverseerActionPayload,
} from './contracts'

export type {
  BackendGraderResponse,
  BackendObservation,
  BackendResetResponse,
  BackendState,
  BackendStepResponse,
  OverseerActionPayload,
} from './contracts'

export function normalizeApiBase(value: string | undefined): string {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '')
  return trimmed === '' ? '/api' : trimmed
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE)

export type ApiErrorKind = 'network' | 'http' | 'shape'

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    throw new ApiError('network', `Cannot reach ${API_BASE}${path} (${err instanceof Error ? err.message : 'network error'})`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const detail = text && !text.trimStart().startsWith('<') ? `: ${text.slice(0, 200)}` : ''
    throw new ApiError('http', `${method} ${API_BASE}${path} → ${res.status}${detail}`)
  }
  try {
    return await res.json()
  } catch {
    throw new ApiError('shape', `${method} ${path} did not return JSON`)
  }
}

async function validated<T>(raw: Promise<unknown>, parse: (v: unknown) => T): Promise<T> {
  const body = await raw
  try {
    return parse(body)
  } catch (err) {
    throw new ApiError('shape', err instanceof Error ? err.message : 'invalid response')
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export const apiReset = (seed?: number, difficulty?: number): Promise<BackendResetResponse> =>
  validated(
    request('POST', '/reset', {
      ...(seed !== undefined && { seed }),
      ...(difficulty !== undefined && { difficulty }),
    }),
    parseResetResponse,
  )

export const apiStep = (action: OverseerActionPayload): Promise<BackendStepResponse> =>
  validated(request('POST', '/step', action), parseStepResponse)

export const apiState = (): Promise<BackendState> => validated(request('GET', '/state'), (v) => parseState(v))

export const apiGrader = (): Promise<BackendGraderResponse> => validated(request('GET', '/grader'), parseGrader)

/** Resolves when the backend reports healthy; rejects with an ApiError otherwise. */
export const apiHealth = async (): Promise<void> => {
  await validated(request('GET', '/health'), parseHealth)
}
