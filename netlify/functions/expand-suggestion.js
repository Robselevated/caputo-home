import { verifyAuth } from './lib/auth.js'
import { checkRateLimit } from './lib/rate-limit.js'
import { makeClient } from './lib/anthropicClient.js'
import { createDeadline } from './lib/budget.js'
import { expandSuggestion, NO_NAME } from './lib/suggestions.js'

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// One meal idea -> a full recipe the cookbook can save.
export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  if (!process.env.CLAUDE_API_KEY) return json(500, { error: 'Server configuration error' })
  const deadline = createDeadline()

  const user = await verifyAuth(event)
  if (!user) return json(401, { error: 'Unauthorized' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }

  // Bad bodies are turned away before they cost a rate-limit slot.
  if (!body || typeof body !== 'object' || !body.name) return json(400, { error: NO_NAME })

  const { allowed } = await checkRateLimit(user.id, 'expand-suggestion', 15)
  if (!allowed) return json(429, { error: 'Rate limit exceeded. Try again later.' })

  const { status, body: out } = await expandSuggestion(body, { client: makeClient(), deadline })
  return json(status, out)
}
