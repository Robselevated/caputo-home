import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) } },
}))

import { authFetch } from './authFetch'

// A fetch stand-in that settles only when its signal aborts, like a request
// still on the wire.
function hangingFetch() {
  return vi.fn((url, { signal }) => new Promise((resolve, reject) => {
    const fail = () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e) }
    if (signal.aborted) return fail()
    signal.addEventListener('abort', fail, { once: true })
  }))
}

describe('authFetch', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('attaches the bearer token and passes the body through', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await authFetch('/fn', { method: 'POST', body: 'x', headers: { 'Content-Type': 'application/json' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('x')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the request when the caller aborts and rejects with an AbortError', async () => {
    const fetchMock = hangingFetch()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const pending = authFetch('/fn', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await assertion
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('rejects at once when the caller signal is already aborted', async () => {
    const fetchMock = hangingFetch()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()
    await expect(authFetch('/fn', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('still reports its own timeout as a timed out request', async () => {
    vi.stubGlobal('fetch', hangingFetch())
    const pending = authFetch('/fn', { signal: new AbortController().signal })
    const assertion = expect(pending).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(56000)
    await assertion
  })
})
