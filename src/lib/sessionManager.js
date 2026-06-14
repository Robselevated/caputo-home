// Session lifecycle manager — the single place that decides "is the session
// usable right now, and what should happen when the app boots or resumes."
//
// Why this exists: the app is an installed iOS PWA. On the first open of the day
// the persisted access token is expired and the phone's radio is cold. The app
// used to render data pages against that stale session and never re-validated on
// resume, producing the "spinner forever until I force-close" bug. This module
// centralizes:
//   - a boot gate that refreshes the token behind a timeout before we trust it
//   - a query-timeout wrapper so no data fetch can hang forever
//   - a resume handler that re-validates + refetches when iOS wakes the app
//   - a tiny revalidate bus so any hook can refetch on a single signal
//
// It reuses readPersistedUser() and the recovery counter; it does NOT add a new
// recovery path beyond the existing splash/chunk recovery in recovery.js.

import { supabase, readPersistedUser } from './supabase'
import { softReloadViaRecovery } from './recovery'

// Resolve `promise`, but if it hasn't settled within `ms`, resolve to
// `timeoutValue` instead. Single source of truth — useAuth and authFetch import
// this instead of redefining their own 2s races.
export function raceTimeout(promise, ms, timeoutValue = { __timeout: true }) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutValue), ms)),
  ])
}

// Wrap a Supabase query so a hang resolves to a Supabase-shaped error response.
// Existing `if (error)` branches already fall back to cache / stop loading, so a
// timed-out query degrades gracefully instead of spinning forever.
export function withQueryTimeout(promise, ms = 8000) {
  return raceTimeout(promise, ms, {
    data: null,
    error: { message: 'Request timed out', __timeout: true },
  })
}

// --- Boot session gate -----------------------------------------------------

// Await getSession() (which auto-refreshes an expired token) behind a timeout.
// Returns one of:
//   { status: 'authenticated',   user }  - fresh session confirmed
//   { status: 'unauthenticated', user: null } - no/invalid session -> login
//   { status: 'unverified',      user }  - getSession hung/offline; render
//                                          optimistically off the persisted user
export async function resolveInitialSession({ timeoutMs = 3000 } = {}) {
  const persisted = readPersistedUser()

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return persisted
      ? { status: 'unverified', user: persisted }
      : { status: 'unauthenticated', user: null }
  }

  let res
  try {
    res = await raceTimeout(supabase.auth.getSession(), timeoutMs)
  } catch {
    res = { __timeout: true }
  }

  if (res?.__timeout) {
    return persisted
      ? { status: 'unverified', user: persisted }
      : { status: 'unauthenticated', user: null }
  }

  const session = res?.data?.session ?? null
  if (session?.user) return { status: 'authenticated', user: session.user }
  return { status: 'unauthenticated', user: null }
}

// --- Revalidate bus --------------------------------------------------------
// Data hooks subscribe; resume / auth-refresh emits. Lets us trigger a refetch
// everywhere from one signal without prop-drilling or hook signature changes.

const revalidateListeners = new Set()

export function onRevalidate(listener) {
  revalidateListeners.add(listener)
  return () => revalidateListeners.delete(listener)
}

export function emitRevalidate(reason) {
  for (const listener of revalidateListeners) {
    try {
      listener(reason)
    } catch {
      // a misbehaving listener must not break the others
    }
  }
}

// --- Realtime reconnect ----------------------------------------------------
// iOS suspends the websocket while the PWA is backgrounded; on resume it can be
// dead-but-"connected". Force a reconnect. Correctness is still guaranteed by
// the refetch (emitRevalidate) — this just restores live updates.
//
// MUST await disconnect() before connect(): disconnect() synchronously drives a
// healthy socket into the CLOSING state, and connect() short-circuits to a no-op
// while isDisconnecting() is true. Awaiting lets the socket reach 'closed' first
// so connect() actually re-establishes it (and rejoins channels) instead of
// silently tearing down live updates until the next hard reload.
export async function reconnectRealtime() {
  try {
    await supabase.realtime.disconnect()
    supabase.realtime.connect()
  } catch {
    // best-effort
  }
}

// --- Resume handler --------------------------------------------------------

const HIDDEN_SOFT_MS = 10 * 1000 // below this, a quick app-switch — do nothing
const HIDDEN_HARD_MS = 30 * 60 * 1000 // above this, token is long dead — reload

let installed = false
let hiddenAt = null
let resuming = false

// Exposed for unit testing the threshold decision in isolation.
export function decideResumeAction(awayMs, online) {
  if (awayMs < HIDDEN_SOFT_MS) return 'ignore'
  if (!online) return 'ignore' // offline: keep cache, never reload
  if (awayMs > HIDDEN_HARD_MS) return 'reload'
  return 'revalidate'
}

export function installResumeHandler() {
  if (installed) return () => {}
  if (typeof document === 'undefined') return () => {}
  installed = true

  const onHidden = () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
  }

  const onVisible = async () => {
    if (document.visibilityState !== 'visible') return
    if (resuming) return
    const awayMs = hiddenAt ? Date.now() - hiddenAt : 0
    hiddenAt = null
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    const action = decideResumeAction(awayMs, online)
    if (action === 'ignore') return

    resuming = true
    try {
      if (action === 'reload') {
        softReloadViaRecovery()
        return
      }
      // revalidate: confirm the session refreshed (bounded), then refetch + relive
      const res = await raceTimeout(supabase.auth.getSession(), 3000)
      if (res?.__timeout) {
        softReloadViaRecovery()
        return
      }
      await reconnectRealtime()
      emitRevalidate('resume')
    } finally {
      resuming = false
    }
  }

  const onPageShow = (e) => {
    if (e.persisted) onVisible() // bfcache restore that visibilitychange can miss
  }

  document.addEventListener('visibilitychange', onHidden)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pageshow', onPageShow)

  return () => {
    installed = false
    document.removeEventListener('visibilitychange', onHidden)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pageshow', onPageShow)
  }
}
