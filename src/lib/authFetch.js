import { supabase } from './supabase'
import { raceTimeout } from './sessionManager'

const SESSION_TIMEOUT_MS = 2000
const FETCH_TIMEOUT_MS = 55000

async function getTokenWithTimeout() {
  try {
    const result = await raceTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS)
    if (result?.__timeout) return null
    return result?.data?.session?.access_token ?? null
  } catch {
    return null
  }
}

function abortError() {
  const err = new Error('Cancelled')
  err.name = 'AbortError'
  return err
}

// fetch with the session token attached and a 55s ceiling. A caller may pass
// its own `signal` (a Cancel button); that abort rejects with an AbortError,
// while our own ceiling still reads as a timeout.
export async function authFetch(url, options = {}) {
  const { signal: callerSignal, ...rest } = options
  if (callerSignal?.aborted) throw abortError()

  const token = await getTokenWithTimeout()
  if (callerSignal?.aborted) throw abortError()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onCallerAbort = () => controller.abort()
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true })

  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...rest.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      if (callerSignal?.aborted) throw abortError()
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', onCallerAbort)
  }
}
