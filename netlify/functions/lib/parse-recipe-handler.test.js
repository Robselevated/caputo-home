// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = { recorded: false }
vi.mock('./auth.js', () => ({ verifyAuth: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('./rate-limit.js', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5 })),
  recordUsage: vi.fn(() => new Promise(resolve => setTimeout(() => { state.recorded = true; resolve() }, 5))),
}))
vi.mock('./anthropicClient.js', () => ({ makeClient: () => ({}) }))
vi.mock('./recipe-url.js', () => ({ parseRecipeFromUrl: vi.fn(async (url) => (url.includes('bad') ? { status: 422, body: { error: 'no' } } : { status: 200, body: { name: 'Soup', ingredients: [] } })) }))

import { handler } from '../parse-recipe.js'
import { recordUsage } from './rate-limit.js'

describe('parse-recipe handler', () => {
  beforeEach(() => { state.recorded = false; vi.clearAllMocks(); process.env.CLAUDE_API_KEY = 'test' })

  it('waits for the usage row before returning a success', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: 'https://blog.test/soup' }) })
    expect(res.statusCode).toBe(200)
    expect(recordUsage).toHaveBeenCalledWith('u1', 'parse-recipe')
    expect(state.recorded).toBe(true)
  })

  it('does not count a failed import', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: 'https://blog.test/bad' }) })
    expect(res.statusCode).toBe(422)
    expect(recordUsage).not.toHaveBeenCalled()
  })
})
