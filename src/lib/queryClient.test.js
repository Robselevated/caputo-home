import { describe, it, expect } from 'vitest'
import { queryClient, GC_TIME } from './queryClient'
import { PERSIST_MAX_AGE } from './persister'

describe('queryClient defaults', () => {
  it('keeps cached data at least as long as the persister keeps it, so restored queries are not garbage-collected', () => {
    const d = queryClient.getDefaultOptions().queries
    expect(d.gcTime).toBe(GC_TIME)
    expect(GC_TIME).toBeGreaterThanOrEqual(PERSIST_MAX_AGE)
  })

  it('does not refetch on window focus (the resume handler is the single trigger) but does on reconnect', () => {
    const d = queryClient.getDefaultOptions().queries
    expect(d.refetchOnWindowFocus).toBe(false)
    expect(d.refetchOnReconnect).toBe(true)
    expect(d.retry).toBe(1)
  })
})
