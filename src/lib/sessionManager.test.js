import { describe, it, expect, vi, beforeEach } from 'vitest'

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
} from './sessionManager'
import { supabase, readPersistedUser } from './supabase'

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

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
  it('reloads after a long suspension', () => {
    expect(decideResumeAction(31 * 60 * 1000, true)).toBe('reload')
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
  it('invokes subscribed listeners on emit', () => {
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
    const a = vi.fn()
    const off = onRevalidate(a)
    off()
    emitRevalidate('x')
    expect(a).not.toHaveBeenCalled()
  })

  it('isolates listener errors so one bad listener does not break others', () => {
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
