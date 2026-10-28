import { verifyAuth } from './lib/auth.js'
import { checkRateLimit } from './lib/rate-limit.js'
import { autocomplete, details } from './lib/places.js'

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// Date Night restaurant search: { action: 'autocomplete' | 'details', ... }.
export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return json(500, { error: 'Restaurant search is not set up yet' })

  const user = await verifyAuth(event)
  if (!user) return json(401, { error: 'Unauthorized' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }

  const run = body?.action === 'autocomplete' ? autocomplete : body?.action === 'details' ? details : null
  if (!run) return json(400, { error: 'Bad request' })

  // Typing fires one autocomplete per pause, so the hourly allowance is roomy.
  const { allowed } = await checkRateLimit(user.id, 'places', 120)
  if (!allowed) return json(429, { error: 'Too many searches. Try again in a bit.' })

  const { status, body: out } = await run(body, { key })
  return json(status, out)
}
