import { useState, useEffect, useContext, createContext, useMemo, useCallback, useRef } from 'react'
import { supabase, readPersistedUser } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_TIMEOUT_MS = 2000

function raceTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), ms)),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readPersistedUser())
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const fetchedForUserRef = useRef(null)

  const fetchProfile = useCallback(async (userId) => {
    if (fetchedForUserRef.current === userId) return
    fetchedForUserRef.current = userId
    try {
      const result = await raceTimeout(
        supabase
          .from('users')
          .select('id, household_id, name, email')
          .eq('id', userId)
          .single(),
        PROFILE_TIMEOUT_MS
      )
      if (result?.__timeout) {
        fetchedForUserRef.current = null
        return
      }
      if (result?.error) {
        console.warn('fetchProfile error:', result.error.message)
        fetchedForUserRef.current = null
        return
      }
      setProfile(result?.data ?? null)
    } catch (err) {
      console.warn('fetchProfile threw:', err?.message ?? err)
      fetchedForUserRef.current = null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    if (user?.id) fetchProfile(user.id)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return
        const nextUser = session?.user ?? null
        setUser(nextUser)
        if (nextUser) {
          fetchProfile(nextUser.id)
        } else {
          setProfile(null)
          fetchedForUserRef.current = null
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    fetchedForUserRef.current = null
  }

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signOut }),
    [user, profile, loading]
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
