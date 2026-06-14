// Bounds EVERY request the Supabase SDK makes.
//
// THE bug this fixes: @supabase/auth-js issues its token-refresh POST to
// /auth/v1/token with no AbortController and no timeout, and its retry wrapper
// only re-tries on a *settled* network error — never on a request that simply
// STALLS. On a cold iOS-PWA radio (first open of the day) that refresh hangs
// indefinitely. It runs while holding GoTrue's auth lock, so initializePromise
// never resolves and every getSession()/query blocks behind it forever — the
// "spinner forever, only a force-close fixes it" bug. Wrapping fetch in an
// abort timeout lets the stalled refresh reject; the SDK then retries on a
// now-warm radio (or settles), initializePromise resolves, and the lock frees.
//
// App-level Promise.race timeouts can't fix this — they bound the caller, not
// the wedged SDK. The cure has to live at the network boundary.

export const SUPABASE_FETCH_TIMEOUT_MS = 8000

function requestUrl(input) {
  if (typeof input === 'string') return input
  if (input && typeof input.url === 'string') return input.url // Request object
  try {
    return String(input) // URL object
  } catch {
    return ''
  }
}

export function makeTimeoutFetch(timeoutMs = SUPABASE_FETCH_TIMEOUT_MS, fetchImpl = fetch) {
  return function timeoutFetch(input, init = {}) {
    // If a caller already controls aborting, don't override it.
    if (init.signal) return fetchImpl(input, init)
    // Storage object transfers (photo upload/download) can legitimately take far
    // longer than 8s on a weak cellular link — never abort those. The timeout
    // exists for the cold-start culprit (the /auth/v1/token refresh) and for
    // small/fast PostgREST queries, not for binary blobs.
    if (requestUrl(input).includes('/storage/v1/object')) return fetchImpl(input, init)
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    return fetchImpl(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(id)
    )
  }
}
