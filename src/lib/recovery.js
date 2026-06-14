// Shared recovery routine for SW upgrade gaps and chunk-load failures.
// Mirrors the inline recoverNow() in index.html and reads the same
// localStorage counter so all three recovery paths (splash timeout,
// manual button, runtime error) respect one 3-attempt 24h budget.

const RESET_COUNT_KEY = 'sw-reset-count'
const RESET_TS_KEY = 'sw-reset-ts'
const MAX_RESETS = 3
const WINDOW_MS = 24 * 60 * 60 * 1000

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'not a valid JavaScript MIME type',
  'Importing a module script failed',
  'error loading dynamically imported module',
]

let recoveryFired = false

export function recoverFromChunkError() {
  if (recoveryFired) return
  recoveryFired = true
  const now = Date.now()
  let firstTs = parseInt(localStorage.getItem(RESET_TS_KEY) || '0', 10)
  let count = parseInt(localStorage.getItem(RESET_COUNT_KEY) || '0', 10)
  if (!firstTs || now - firstTs > WINDOW_MS) {
    firstTs = now
    count = 0
    localStorage.setItem(RESET_TS_KEY, String(firstTs))
  }
  if (count >= MAX_RESETS) return
  localStorage.setItem(RESET_COUNT_KEY, String(count + 1))

  const reload = () => window.location.reload()
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(reload)
      .catch(reload)
  } else {
    reload()
  }
}

export function looksLikeChunkError(message) {
  if (!message) return false
  const str = typeof message === 'string' ? message : String(message)
  return CHUNK_ERROR_PATTERNS.some((p) => str.includes(p))
}

// Lighter recovery for the resume path: when the app has been backgrounded long
// enough that the token is certainly dead (or getSession hangs on wake), a plain
// reload gets a fresh document + fresh session without nuking the SW/caches.
// Shares the SAME 3-attempt / 24h counter as recoverFromChunkError so the two
// paths can never combine into a reload loop. Never reloads while offline.
export function softReloadViaRecovery() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const now = Date.now()
  let firstTs = parseInt(localStorage.getItem(RESET_TS_KEY) || '0', 10)
  let count = parseInt(localStorage.getItem(RESET_COUNT_KEY) || '0', 10)
  if (!firstTs || now - firstTs > WINDOW_MS) {
    firstTs = now
    count = 0
    localStorage.setItem(RESET_TS_KEY, String(firstTs))
  }
  if (count >= MAX_RESETS) return
  localStorage.setItem(RESET_COUNT_KEY, String(count + 1))
  window.location.reload()
}
