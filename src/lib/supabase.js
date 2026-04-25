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
