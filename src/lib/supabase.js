import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

function getStorageKey() {
  try {
    const url = new URL(supabaseUrl)
    const ref = url.hostname.split('.')[0]
    return `sb-${ref}-auth-token`
  } catch {
    return null
  }
}

// Cache of the user's profile row (id, household_id, name, email). The
// household_id is stable for the life of the account, so we persist it and seed
// it synchronously on boot. This keeps `householdId` available on the very first
// paint instead of waiting on a cold-radio network fetch — the root cause of the
// "spinner forever on first open" bug, where a slow profile fetch left
// householdId undefined and every data hook stuck on its loading spinner.
const PROFILE_CACHE_KEY = 'caputo-profile-cache'

export function readPersistedProfile() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p && p.id && p.household_id) return p
    return null
  } catch {
    return null
  }
}

export function persistProfile(profile) {
  if (typeof window === 'undefined') return
  try {
    if (profile?.id && profile?.household_id) {
      window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
    }
  } catch {
    // ignore quota / serialization errors — cache is best-effort
  }
}

export function clearPersistedProfile() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // ignore
  }
}

// Sync read of the persisted session so boot can seed UI state without
// awaiting the SDK. Falls through to onAuthStateChange for the source of truth.
// Handles both the main session key and the separate -user key the SDK may use.
export function readPersistedUser() {
  if (typeof window === 'undefined') return null
  const key = getStorageKey()
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      const u = parsed?.user ?? parsed?.currentSession?.user
      if (u && typeof u === 'object' && u.id) return u
    }
    const userRaw = window.localStorage.getItem(key + '-user')
    if (userRaw) {
      const parsed = JSON.parse(userRaw)
      const u = parsed?.user
      if (u && typeof u === 'object' && u.id) return u
    }
    return null
  } catch {
    return null
  }
}

// Pause autoRefresh while hidden — Supabase's recommended PWA pattern.
// Stops the SDK from getting stuck mid-refresh when iOS suspends the app.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}
