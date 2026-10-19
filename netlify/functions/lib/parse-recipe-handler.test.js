// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = { settled: null }
const settle = vi.fn((ok) => new Promise(resolve => setTimeout(() => { state.settled = ok; resolve() }, 5)))
vi.mock('./auth.js', () => ({ verifyAuth: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('./rate-limit.js', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5, settle })),
}))
vi.mock('./anthropicClient.js', () => ({ makeClient: () => ({}) }))
vi.mock('./recipe-url.js', () => ({ parseRecipeFromUrl: vi.fn(async (url) => (url.includes('bad') ? { status: 422, body: { error: 'no' } } : { status: 200, body: { name: 'Soup', ingredients: [] } })) }))

import { handler } from '../parse-recipe.js'
import { checkRateLimit } from './rate-limit.js'

describe('parse-recipe handler', () => {
  beforeEach(() => { state.settled = null; vi.clearAllMocks(); process.env.CLAUDE_API_KEY = 'test' })

  it('settles the reservation as used before returning a success', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: 'https://blog.test/soup' }) })
    expect(res.statusCode).toBe(200)
    expect(checkRateLimit).toHaveBeenCalledWith('u1', 'parse-recipe', 20, { reserve: false })
    expect(state.settled).toBe(true)
  })

  it('gives the slot back for a failed import', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: 'https://blog.test/bad' }) })
    expect(res.statusCode).toBe(422)
    expect(settle).toHaveBeenCalledWith(false)
    expect(state.settled).toBe(false)
  })

  it('turns away a bad body before it reserves a slot', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' })
    expect(res.statusCode).toBe(400)
    expect(checkRateLimit).not.toHaveBeenCalled()
  })
})
