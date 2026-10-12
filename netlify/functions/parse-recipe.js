import { verifyAuth } from './lib/auth.js'
import { checkRateLimit, recordUsage } from './lib/rate-limit.js'
import { makeClient } from './lib/anthropicClient.js'
import { createDeadline } from './lib/budget.js'
import { parseRecipeFromUrl } from './lib/recipe-url.js'

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

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

  let url
  try { ({ url } = JSON.parse(event.body || '{}')) } catch { return json(400, { error: 'Bad request' }) }
  if (!url) return json(400, { error: 'Missing url parameter' })

  const { status, body } = await parseRecipeFromUrl(url, { client: makeClient(), deadline })
  if (status === 200) recordUsage(user.id, 'parse-recipe').catch(() => {})
  return json(status, body)
}
