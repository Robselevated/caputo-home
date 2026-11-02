import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/authFetch', () => ({ authFetch: vi.fn() }))

import { authFetch } from '../../lib/authFetch'
import { searchPlaces, NETWORK_ERROR } from './placesSearch'

const ok = (body) => ({ ok: true, json: async () => body })
const results = [{ placeId: 'p1', name: 'Thirst Tap House', secondary: 'Coeur d\'Alene, ID' }]

// Runs the search while letting the retry delay pass.
async function search(opts) {
  const pending = searchPlaces('thirst', { sessionToken: 'token-123', ...opts })
  pending.catch(() => {})
  await vi.runAllTimersAsync()
  return pending
}

beforeEach(() => {
  vi.useFakeTimers()
  authFetch.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('searchPlaces', () => {
  it('tries once more when the request never got an answer', async () => {
    authFetch.mockRejectedValueOnce(new TypeError('Load failed')).mockResolvedValueOnce(ok({ results }))
    await expect(search()).resolves.toEqual(results)
    expect(authFetch).toHaveBeenCalledTimes(2)
  })

  it('says to check the signal, not "Load failed", when the retry fails too', async () => {
    authFetch.mockRejectedValue(new TypeError('Load failed'))
    await expect(search()).rejects.toThrow(NETWORK_ERROR)
    expect(authFetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry a cancelled search', async () => {
    const err = new Error('Cancelled')
    err.name = 'AbortError'
    authFetch.mockRejectedValue(err)
    await expect(search()).rejects.toMatchObject({ name: 'AbortError' })
    expect(authFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a request whose signal was aborted while it failed', async () => {
    const controller = new AbortController()
    controller.abort()
    authFetch.mockRejectedValue(new TypeError('Load failed'))
    await expect(search({ signal: controller.signal })).rejects.toThrow('Load failed')
    expect(authFetch).toHaveBeenCalledTimes(1)
  })

  it('shows the server\'s message for an error response, without retrying', async () => {
    authFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Couldn't reach Google search" }) })
    await expect(search()).rejects.toThrow("Couldn't reach Google search")
    expect(authFetch).toHaveBeenCalledTimes(1)
  })
})
