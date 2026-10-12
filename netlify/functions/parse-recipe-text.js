import { verifyAuth } from './lib/auth.js'
import { checkRateLimit, recordUsage } from './lib/rate-limit.js'
import { makeClient } from './lib/anthropicClient.js'
import { createDeadline } from './lib/budget.js'
import { parseRecipeFromText, EMPTY_TEXT } from './lib/recipe-text.js'

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// Pasted recipe text -> the import contract. Shares the link import's hourly
// allowance; only a successful read counts against it.
export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  if (!process.env.CLAUDE_API_KEY) {
    return json(500, { error: 'Server configuration error', details: 'CLAUDE_API_KEY env var is not set in Netlify' })
  }
  const deadline = createDeadline(50000)

  const user = await verifyAuth(event)
  if (!user) return json(401, { error: 'Unauthorized' })

  const { allowed } = await checkRateLimit(user.id, 'parse-recipe', 20, { reserve: false })
  if (!allowed) return json(429, { error: 'Rate limit exceeded. Try again later.' })

  let text
  try { ({ text } = JSON.parse(event.body || '{}')) } catch { return json(400, { error: 'Bad request' }) }
  if (typeof text !== 'string') return json(400, { error: EMPTY_TEXT })

  const { status, body } = await parseRecipeFromText(text, { client: makeClient(), deadline })
  if (status === 200) recordUsage(user.id, 'parse-recipe').catch(() => {})
  return json(status, body)
}
