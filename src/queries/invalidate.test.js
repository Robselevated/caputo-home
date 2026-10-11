import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { invalidateDebounced } from './invalidate'

describe('invalidateDebounced', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('invalidates at once, then collapses a burst for the same key into one trailing call', () => {
    const qc = { invalidateQueries: vi.fn() }
    invalidateDebounced(qc, ['a'])
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1)
    invalidateDebounced(qc, ['a'])
    invalidateDebounced(qc, ['a'])
    invalidateDebounced(qc, ['b'])
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(600)
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(3)
    expect(qc.invalidateQueries.mock.calls.filter(c => c[0].queryKey[0] === 'a')).toHaveLength(2)
    expect(qc.invalidateQueries.mock.calls.filter(c => c[0].queryKey[0] === 'b')).toHaveLength(1)
  })
})
