import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = async (email, pin) => {
    // Try signing in first
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    })

    if (error?.message?.includes('Invalid login credentials')) {
      // User doesn't exist yet, create account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: pin,
      })
      if (signUpError) return { error: signUpError }

      // If email confirmation is required, signUp returns a user but no session
      // In that case, try signing in immediately after
      if (!signUpData?.session) {
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: pin,
        })
        if (retryError) return { error: retryError }
      }

      return { error: null }
    }

    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return { user, profile, loading, signIn, signOut }
}
