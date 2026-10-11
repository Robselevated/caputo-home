import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    realtime: { disconnect: vi.fn(), connect: vi.fn() },
  },
  readPersistedUser: vi.fn(),
}))

vi.mock('./recovery', () => ({
  softReloadViaRecovery: vi.fn(),
}))

import {
  raceTimeout,
  withQueryTimeout,
  decideResumeAction,
  resolveInitialSession,
  onRevalidate,
  emitRevalidate,
  reconnectRealtime,
  installResumeHandler,
} from './sessionManager'
import { supabase, readPersistedUser } from './supabase'
import { softReloadViaRecovery } from './recovery'

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

// emitRevalidate coalesces within 2s of the previous emit (module state), so
// every test that emits starts its fake clock an hour after the last one.
let clock = Date.parse('2026-10-11T12:00:00Z')
const freshClock = () => { clock += 60 * 60 * 1000; return new Date(clock) }

beforeEach(() => {
  vi.clearAllMocks()
  setOnline(true)
})

describe('raceTimeout', () => {
  it('resolves to the promise value when it settles in time', async () => {
    expect(await raceTimeout(Promise.resolve('ok'), 50)).toBe('ok')
  })

  it('resolves to the timeout sentinel when the promise is too slow', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 100))
    expect(await raceTimeout(slow, 10)).toEqual({ __timeout: true })
  })

  it('honors a custom timeout value', async () => {
    expect(await raceTimeout(new Promise(() => {}), 10, 'fallback')).toBe('fallback')
  })
})

describe('withQueryTimeout', () => {
  it('passes through a fast query result', async () => {
    const fast = Promise.resolve({ data: [1], error: null })
    expect(await withQueryTimeout(fast, 50)).toEqual({ data: [1], error: null })
  })

  it('returns a supabase-shaped error on timeout', async () => {
    const result = await withQueryTimeout(new Promise(() => {}), 10)
    expect(result.data).toBeNull()
    expect(result.error?.__timeout).toBe(true)
  })
})

describe('decideResumeAction', () => {
  it('ignores quick app-switches under the soft threshold', () => {
    expect(decideResumeAction(5000, true)).toBe('ignore')
  })
  it('ignores any resume while offline', () => {
    expect(decideResumeAction(60000, false)).toBe('ignore')
  })
  it('revalidates a medium background gap', () => {
    expect(decideResumeAction(60000, true)).toBe('revalidate')
  })
  it('revalidates (never reloads) after a long suspension', () => {
    expect(decideResumeAction(31 * 60 * 1000, true)).toBe('revalidate')
    expect(decideResumeAction(9 * 60 * 60 * 1000, true)).toBe('revalidate')
  })
})

describe('resolveInitialSession', () => {
  it('returns unverified when offline with a persisted user', async () => {
    setOnline(false)
    readPersistedUser.mockReturnValue({ id: 'u1' })
    expect(await resolveInitialSession()).toEqual({ status: 'unverified', user: { id: 'u1' } })
  })

  it('returns unauthenticated when offline with no persisted user', async () => {
    setOnline(false)
    readPersistedUser.mockReturnValue(null)
    expect((await resolveInitialSession()).status).toBe('unauthenticated')
  })

  it('returns authenticated when getSession yields a session', async () => {
    readPersistedUser.mockReturnValue({ id: 'u1' })
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const r = await resolveInitialSession()
    expect(r.status).toBe('authenticated')
    expect(r.user).toEqual({ id: 'u1' })
  })

  it('returns unauthenticated when getSession yields no session', async () => {
    readPersistedUser.mockReturnValue({ id: 'u1' })
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    expect((await resolveInitialSession()).status).toBe('unauthenticated')
  })

  it('returns unverified when getSession hangs past the timeout', async () => {
    readPersistedUser.mockReturnValue({ id: 'u1' })
    supabase.auth.getSession.mockReturnValue(new Promise(() => {}))
    expect(await resolveInitialSession({ timeoutMs: 20 })).toEqual({
      status: 'unverified',
      user: { id: 'u1' },
    })
  })
})

describe('reconnectRealtime', () => {
  it('fully awaits disconnect before reconnecting (avoids the CLOSING no-op race)', async () => {
    const order = []
    // Model the async close: disconnect resolves on a later tick, the way the
    // real socket reaches 'closed'. connect() must run only after that.
    supabase.realtime.disconnect.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => { order.push('disconnect'); resolve() }, 5))
    )
    supabase.realtime.connect.mockImplementation(() => { order.push('connect') })

    await reconnectRealtime()

    expect(order).toEqual(['disconnect', 'connect'])
    expect(supabase.realtime.disconnect).toHaveBeenCalledTimes(1)
    expect(supabase.realtime.connect).toHaveBeenCalledTimes(1)
  })

  it('swallows errors so a flaky socket never breaks resume', async () => {
    supabase.realtime.disconnect.mockRejectedValue(new Error('socket boom'))
    await expect(reconnectRealtime()).resolves.toBeUndefined()
  })
})

describe('revalidate bus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(freshClock())
  })
  afterEach(() => vi.useRealTimers())

  it('coalesces emits that arrive within 2s (resume + TOKEN_REFRESHED fire back to back)', () => {
    vi.advanceTimersByTime(5000)
    const a = vi.fn()
    const off = onRevalidate(a)
    emitRevalidate('resume')
    emitRevalidate('TOKEN_REFRESHED')
    expect(a).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2500)
    emitRevalidate('resume')
    expect(a).toHaveBeenCalledTimes(2)
    off()
  })

  it('invokes subscribed listeners on emit', () => {
    vi.advanceTimersByTime(5000)
    const a = vi.fn()
    const b = vi.fn()
    const offA = onRevalidate(a)
    const offB = onRevalidate(b)
    emitRevalidate('resume')
    expect(a).toHaveBeenCalledWith('resume')
    expect(b).toHaveBeenCalledWith('resume')
    offA()
    offB()
  })

  it('stops invoking after unsubscribe', () => {
    vi.advanceTimersByTime(5000)
    const a = vi.fn()
    const off = onRevalidate(a)
    off()
    emitRevalidate('x')
    expect(a).not.toHaveBeenCalled()
  })

  it('isolates listener errors so one bad listener does not break others', () => {
    vi.advanceTimersByTime(5000)
    const bad = vi.fn(() => { throw new Error('boom') })
    const good = vi.fn()
    const off1 = onRevalidate(bad)
    const off2 = onRevalidate(good)
    expect(() => emitRevalidate('y')).not.toThrow()
    expect(good).toHaveBeenCalled()
    off1()
    off2()
  })
})

describe('resume handler', () => {
  function setVisibility(state) {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('after a long background gap it revalidates and reconnects instead of reloading the page', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(freshClock())
    try {
      supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
      supabase.realtime.disconnect.mockResolvedValue()
      const seen = vi.fn()
      const off = onRevalidate(seen)
      const uninstall = installResumeHandler()
      vi.advanceTimersByTime(10000)
      setVisibility('hidden')
      vi.advanceTimersByTime(45 * 60 * 1000)
      setVisibility('visible')
      await vi.runAllTimersAsync()
      expect(softReloadViaRecovery).not.toHaveBeenCalled()
      expect(supabase.realtime.connect).toHaveBeenCalled()
      expect(seen).toHaveBeenCalledWith('resume')
      off()
      uninstall()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a hung getSession on resume still refetches (no reload) and signs nobody out', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(freshClock())
    try {
      supabase.auth.getSession.mockReturnValue(new Promise(() => {}))
      supabase.realtime.disconnect.mockResolvedValue()
      const seen = vi.fn()
      const off = onRevalidate(seen)
      const uninstall = installResumeHandler()
      vi.advanceTimersByTime(10000)
      setVisibility('hidden')
      vi.advanceTimersByTime(60 * 1000)
      setVisibility('visible')
      await vi.advanceTimersByTimeAsync(4000)
      expect(softReloadViaRecovery).not.toHaveBeenCalled()
      expect(seen).toHaveBeenCalledWith('resume')
      off()
      uninstall()
    } finally {
      vi.useRealTimers()
    }
  })
})
