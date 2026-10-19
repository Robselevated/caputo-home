import { verifyAuth } from './lib/auth.js'
import { checkRateLimit } from './lib/rate-limit.js'
import { makeClient } from './lib/anthropicClient.js'
import { createDeadline } from './lib/budget.js'
import { parseRecipeFromImages, imagesFromBody, NO_PHOTOS } from './lib/recipe-image.js'

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  if (!process.env.CLAUDE_API_KEY) {
    return json(500, { error: 'Server configuration error', details: 'CLAUDE_API_KEY env var is not set in Netlify' })
  }
  const deadline = createDeadline()

  const user = await verifyAuth(event)
  if (!user) return json(401, { error: 'Unauthorized' })

  let images
  try { images = imagesFromBody(JSON.parse(event.body || '{}')) } catch { return json(400, { error: 'Bad request' }) }
  if (!images.length) return json(400, { error: NO_PHOTOS })

  // One call reads a whole batch of photos now, so the allowance counts
  // scans, not pages, and only successful ones.
  const { allowed, settle } = await checkRateLimit(user.id, 'parse-recipe-image', 120, { reserve: false })
  if (!allowed) return json(429, { error: 'Rate limit exceeded. Try again later.' })

  const { status, body } = await parseRecipeFromImages(images, { client: makeClient(), deadline })
  await settle(status === 200).catch(() => {})
  return json(status, body)
}
