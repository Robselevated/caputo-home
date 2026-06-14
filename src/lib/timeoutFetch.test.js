import { describe, it, expect, vi } from 'vitest'
import { makeTimeoutFetch } from './timeoutFetch'

describe('makeTimeoutFetch', () => {
  it('aborts the underlying fetch once the timeout elapses', async () => {
    let seenSignal
    const fetchImpl = vi.fn((input, init) => {
      seenSignal = init.signal
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        )
      })
    })
    const tf = makeTimeoutFetch(20, fetchImpl)
    await expect(tf('/auth/v1/token')).rejects.toThrow()
    expect(seenSignal.aborted).toBe(true)
  })

  it('resolves normally when the fetch beats the timeout', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve('ok'))
    const tf = makeTimeoutFetch(1000, fetchImpl)
    await expect(tf('/rest/v1/users')).resolves.toBe('ok')
  })

  it('passes a caller-provided signal straight through (no double-abort)', () => {
    const fetchImpl = vi.fn(() => Promise.resolve('ok'))
    const ctrl = new AbortController()
    const tf = makeTimeoutFetch(20, fetchImpl)
    tf('/x', { signal: ctrl.signal })
    expect(fetchImpl).toHaveBeenCalledWith('/x', { signal: ctrl.signal })
  })
})
