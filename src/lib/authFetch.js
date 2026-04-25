import { supabase } from './supabase'

const SESSION_TIMEOUT_MS = 2000
const FETCH_TIMEOUT_MS = 55000

async function getTokenWithTimeout() {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) =>
        setTimeout(() => resolve({ __timeout: true }), SESSION_TIMEOUT_MS)
      ),
    ])
    if (result?.__timeout) return null
    return result?.data?.session?.access_token ?? null
  } catch {
    return null
  }
}

export async function authFetch(url, options = {}) {
  const token = await getTokenWithTimeout()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
