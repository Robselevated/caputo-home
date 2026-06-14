import { useState, useEffect, useContext, createContext, useMemo, useCallback, useRef } from 'react'
import {
  supabase,
  readPersistedUser,
  readPersistedProfile,
  persistProfile,
  clearPersistedProfile,
} from '../lib/supabase'
import { raceTimeout, resolveInitialSession, emitRevalidate } from '../lib/sessionManager'

const AuthContext = createContext(null)

// Cold radios on the first open of the day can be slow; give the profile fetch
// real headroom and RETRY instead of giving up. The old 2s-with-no-retry race
// stranded householdId and left every page spinning forever.
const PROFILE_TIMEOUT_MS = 6000
const PROFILE_MAX_RETRIES = 4
// Hard backstop: if we're online and the profile still hasn't loaded after this
// long, stop spinning and surface a retry. Guarantees the household resolution
// can never present as an infinite spinner again, whatever the cause. Set above
// the realistic cold-radio recovery window (bounded auth refresh ~8s + a warm
// retry) so it backstops a true wedge rather than pre-empting a slow-but-working load.
const PROFILE_HARD_TIMEOUT_MS = 20000

function seedProfile() {
  const u = readPersistedUser()
  const p = readPersistedProfile()
  // Only trust the cached profile if it belongs to the persisted user.
  return p && u && p.id === u.id ? p : null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readPersistedUser())
  // Seed profile synchronously so householdId is available on first paint.
  const [profile, setProfile] = useState(seedProfile)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)
  const fetchedForUserRef = useRef(null)
  const currentUserIdRef = useRef(user?.id ?? null)

  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null
  }, [user])

  const fetchProfile = useCallback(async (userId, attempt = 0) => {
    if (!userId) return
    // Dedupe the initial fetch per user, but always allow scheduled retries.
    if (attempt === 0 && fetchedForUserRef.current === userId) return
    fetchedForUserRef.current = userId

    const retry = () => {
      if (attempt < PROFILE_MAX_RETRIES) {
        const delay = Math.min(800 * 2 ** attempt, 8000)
        setTimeout(() => {
          if (currentUserIdRef.current === userId) fetchProfile(userId, attempt + 1)
        }, delay)
      } else {
        // Out of retries — release the guard and surface an error so the UI can
        // offer a retry instead of wedging householdId (and the spinner) forever.
        fetchedForUserRef.current = null
        setProfileError(true)
      }
    }

    try {
      const result = await raceTimeout(
        supabase
          .from('users')
          .select('id, household_id, name, email')
          .eq('id', userId)
          .single(),
        PROFILE_TIMEOUT_MS
      )
      if (result?.error?.code === 'PGRST116') {
        // No users row for this account (e.g. the signup trigger never ran).
        // Retrying can't conjure a row — surface a terminal error so the user
        // gets a Sign out escape hatch instead of looping forever.
        console.warn('fetchProfile: no profile row for user', userId)
        fetchedForUserRef.current = null
        setProfileError(true)
        return
      }
      if (result?.__timeout || result?.error) {
        if (result?.error) console.warn('fetchProfile error:', result.error.message)
        retry()
        return
      }
      if (result?.data) {
        setProfile(result.data)
        persistProfile(result.data)
        setProfileError(false)
      }
    } catch (err) {
      console.warn('fetchProfile threw:', err?.message ?? err)
      retry()
    }
  }, [])

  const retryProfile = useCallback(() => {
    setProfileError(false)
    fetchedForUserRef.current = null
    const uid = currentUserIdRef.current
    if (uid) fetchProfile(uid)
  }, [fetchProfile])

  useEffect(() => {
    let mounted = true

    // Boot gate: confirm/refresh the session behind a timeout BEFORE we declare
    // loading done, so data pages never render against a stale (expired) token.
    resolveInitialSession({ timeoutMs: 3000 }).then((result) => {
      if (!mounted) return
      if (result.status === 'authenticated') {
        setUser(result.user)
        fetchProfile(result.user.id)
      } else if (result.status === 'unauthenticated') {
        setUser(null)
        setProfile(null)
        clearPersistedProfile()
        fetchedForUserRef.current = null
      } else if (result.status === 'unverified' && result.user) {
        // getSession hung or we're offline — render optimistically off the
        // persisted user and keep trying to (re)load the profile.
        fetchProfile(result.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return
        const nextUser = session?.user ?? null
        setUser(nextUser)
        if (nextUser) {
          // Defer Supabase work out of the auth callback: calling getSession/
          // queries synchronously here re-enters GoTrue's auth lock and can
          // deadlock (the documented "don't await inside onAuthStateChange").
          setTimeout(() => fetchProfile(nextUser.id), 0)
          // A fresh token after sign-in or refresh: tell data hooks to refetch
          // so they pick up the new session instead of holding stale results.
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            emitRevalidate(event)
          }
        } else {
          setProfile(null)
          clearPersistedProfile()
          fetchedForUserRef.current = null
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Hard backstop watchdog: online + signed in + still no profile after the
  // timeout => surface the error screen instead of an endless spinner.
  useEffect(() => {
    if (profile || !user || profileError) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const id = setTimeout(() => setProfileError(true), PROFILE_HARD_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [profile, user, profileError])

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    clearPersistedProfile()
    fetchedForUserRef.current = null
    setProfileError(false)
  }

  const value = useMemo(
    () => ({ user, profile, loading, profileError, retryProfile, signIn, signOut }),
    [user, profile, loading, profileError, retryProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
