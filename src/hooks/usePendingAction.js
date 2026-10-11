import { useRef, useEffect, useCallback, useState } from 'react'

// Deferred, undo-able action. schedule(key, payload) marks the key pending now
// and runs `action(payload)` after `delayMs` unless cancel(key) comes first.
// Everything pending is flushed on pagehide and on unmount so leaving the app
// mid-window never loses the change. The action is read through a ref, so a
// parent re-render (or a new function identity) never flushes early — that was
// the GroceryList undo-window bug.
export function usePendingAction(action, { delayMs = 1500 } = {}) {
  const actionRef = useRef(action)
  actionRef.current = action
  const pendingRef = useRef(new Map()) // key -> { payload, timeoutId }
  const [pendingKeys, setPendingKeys] = useState(() => new Set())

  const forget = (key) => {
    pendingRef.current.delete(key)
    setPendingKeys(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const run = useCallback((key) => {
    const entry = pendingRef.current.get(key)
    if (!entry) return
    clearTimeout(entry.timeoutId)
    forget(key)
    try {
      actionRef.current(entry.payload)
    } catch (err) {
      console.error('pending action failed', err)
    }
  }, [])

  const schedule = useCallback((key, payload) => {
    const existing = pendingRef.current.get(key)
    if (existing) clearTimeout(existing.timeoutId)
    const timeoutId = setTimeout(() => run(key), delayMs)
    pendingRef.current.set(key, { payload, timeoutId })
    setPendingKeys(prev => (prev.has(key) ? prev : new Set(prev).add(key)))
  }, [delayMs, run])

  const cancel = useCallback((key) => {
    const entry = pendingRef.current.get(key)
    if (!entry) return
    clearTimeout(entry.timeoutId)
    forget(key)
  }, [])

  const flush = useCallback(() => {
    for (const key of Array.from(pendingRef.current.keys())) run(key)
  }, [run])

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  const isPending = useCallback((key) => pendingKeys.has(key), [pendingKeys])

  return { schedule, cancel, flush, isPending, pendingKeys }
}
