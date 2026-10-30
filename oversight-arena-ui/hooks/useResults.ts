'use client'
import { useEffect, useState } from 'react'
import { loadResultsFromNetwork, type ResultsBundle } from '@/lib/evaluation'

let cached: Promise<ResultsBundle> | null = null

/** Loads the recorded experiment results once per page load. `null` while loading. */
export function useResults(): ResultsBundle | null {
  const [bundle, setBundle] = useState<ResultsBundle | null>(null)
  useEffect(() => {
    let live = true
    cached ??= loadResultsFromNetwork()
    cached.then((b) => live && setBundle(b))
    return () => {
      live = false
    }
  }, [])
  return bundle
}
