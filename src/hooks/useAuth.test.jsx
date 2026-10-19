import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const authState = { session: null, listeners: [], persistedUser: null, persistedProfile: null }
vi.mock('../lib/supabase', async () => {
  const actual = await vi.importActual('../lib/supabase')
  return {
    ...actual,
    readPersistedUser: () => authState.persistedUser,
    readPersistedProfile: () => authState.persistedProfile,
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: authState.session }, error: null })),
        onAuthStateChange: vi.fn((cb) => { authState.listeners.push(cb); return { data: { subscription: { unsubscribe: vi.fn() } } } }),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        startAutoRefresh: vi.fn(),
        stopAutoRefresh: vi.fn(),
      },
      from: vi.fn(() => {
        const b = {}
        for (const m of ['select', 'eq', 'single']) b[m] = vi.fn(() => b)
        b.then = (res) => Promise.resolve({ data: { id: 'u1', household_id: 'hh', name: 'Rob', email: 'r@x' }, error: null }).then(res)
        return b
      }),
    },
  }
})

vi.mock('../lib/db', () => ({ clearAllWrites: vi.fn(async () => {}) }))
vi.mock('../lib/persister', async (orig) => ({ ...(await orig()), clearPersistedQueryCache: vi.fn(async () => {}) }))

import { supabase } from '../lib/supabase'
import { clearAllWrites } from '../lib/db'
import { clearPersistedQueryCache } from '../lib/persister'
import { queryClient } from '../lib/queryClient'
import { AuthProvider, useAuth } from './useAuth'
import { onRevalidate } from '../lib/sessionManager'

function Probe() {
  const { loading, user, profile } = useAuth()
  return <div>{loading ? 'loading' : `ready:${user?.id ?? 'none'}:${profile?.household_id ?? 'none'}`}</div>
}

const user = { id: 'u1', email: 'r@x' }

beforeEach(() => {
  localStorage.clear()
  authState.session = null
  authState.listeners = []
  authState.persistedUser = null
  authState.persistedProfile = null
  vi.clearAllMocks()
})

describe('AuthProvider boot', () => {
  it('renders ready on the FIRST paint when a user and profile are persisted (no boot spinner)', () => {
    authState.persistedUser = user
    authState.persistedProfile = { id: 'u1', household_id: 'hh', name: 'Rob', email: 'r@x' }
    authState.session = { user }
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByText('ready:u1:hh')).toBeInTheDocument()
  })

  it('shows the boot loader when nothing is persisted (first login)', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await act(async () => {})
    expect(screen.getByText('ready:none:none')).toBeInTheDocument()
  })

  it('does not refetch the profile on every TOKEN_REFRESHED once it is known', async () => {
    authState.persistedUser = user
    authState.persistedProfile = { id: 'u1', household_id: 'hh', name: 'Rob', email: 'r@x' }
    authState.session = { user }
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => {})
    const before = supabase.from.mock.calls.length
    await act(async () => { authState.listeners.forEach(cb => cb('TOKEN_REFRESHED', { user })); await new Promise(r => setTimeout(r, 5)) })
    await act(async () => { authState.listeners.forEach(cb => cb('TOKEN_REFRESHED', { user })); await new Promise(r => setTimeout(r, 5)) })
    expect(supabase.from.mock.calls.length).toBe(before)
  })
})

describe('AuthProvider SIGNED_IN re-emits', () => {
  it('treats a re-emitted SIGNED_IN for the same user as a no-op (no revalidate, same user object)', async () => {
    authState.persistedUser = user
    authState.persistedProfile = { id: 'u1', household_id: 'hh', name: 'Rob', email: 'r@x' }
    authState.session = { user }
    const seen = []
    function UserProbe() { const { user: u } = useAuth(); seen.push(u); return null }
    let now = 1_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => (now += 10_000))
    const reasons = []
    const off = onRevalidate((r) => reasons.push(r))
    try {
      render(<AuthProvider><UserProbe /></AuthProvider>)
      await act(async () => {})
      const settled = seen[seen.length - 1]
      const renders = seen.length
      await act(async () => { authState.listeners.forEach(cb => cb('SIGNED_IN', { user: { ...user } })) })
      expect(reasons).not.toContain('SIGNED_IN')
      expect(seen[seen.length - 1]).toBe(settled)
      expect(seen.length).toBe(renders)

      // A different account signing in IS a login.
      await act(async () => { authState.listeners.forEach(cb => cb('SIGNED_IN', { user: { id: 'u2', email: 'c@x' } })) })
      expect(reasons).toContain('SIGNED_IN')
      expect(seen[seen.length - 1].id).toBe('u2')
    } finally {
      off()
      nowSpy.mockRestore()
    }
  })
})

describe('AuthProvider signOut', () => {
  it('clears the query cache, the persisted snapshot and the offline write queue', async () => {
    authState.persistedUser = user
    authState.persistedProfile = { id: 'u1', household_id: 'hh', name: 'Rob', email: 'r@x' }
    authState.session = { user }
    queryClient.setQueryData(['grocery_items', 'hh'], [{ id: 'g1' }])
    let api
    function Grab() { api = useAuth(); return null }
    render(<AuthProvider><Grab /></AuthProvider>)
    await act(async () => {})
    await act(async () => { await api.signOut() })
    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(queryClient.getQueryData(['grocery_items', 'hh'])).toBeUndefined()
    expect(clearPersistedQueryCache).toHaveBeenCalledTimes(1)
    expect(clearAllWrites).toHaveBeenCalledTimes(1)
    expect(api.user).toBeNull()
  })
})
