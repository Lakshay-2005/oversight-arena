'use client'
import { useEffect } from 'react'
import { useArenaStore } from '@/store/arenaStore'

/** Starts the backend health check / first episode once, after hydration. */
export default function StoreBootstrap() {
  const init = useArenaStore((s) => s.init)
  useEffect(() => {
    init()
  }, [init])
  return null
}
