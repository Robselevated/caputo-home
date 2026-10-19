// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const beta = vi.fn()
const stable = vi.fn()
vi.mock('./anthropicClient.js', () => ({ makeClient: () => ({ beta: { messages: { create: beta } }, messages: { create: stable } }) }))
vi.mock('./auth.js', () => ({ verifyAuth: vi.fn(async () => ({ id: 'rob', household_id: 'hh' })) }))
vi.mock('./rate-limit.js', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5 })) }))

const { handler } = await import('../claude-scan.js')
const post = (body) => handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) })
const reply = (text) => ({ content: [{ type: 'text', text }] })
const photo = { image_base64: 'abc', media_type: 'image/jpeg', scan_type: 'pantry' }

beforeEach(() => { beta.mockReset(); stable.mockReset() })

describe('claude-scan', () => {
  it('returns the items the model lists', async () => {
    beta.mockResolvedValue(reply('[{"name":"Rice","qty":2}]'))
    const res = await post(photo)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([{ name: 'Rice', qty: 2 }])
    expect(stable).not.toHaveBeenCalled()
  })

  it('refuses an image link and an unknown media type', async () => {
    expect((await post({ image_url: 'http://169.254.169.254/', scan_type: 'pantry' })).statusCode).toBe(400)
    expect((await post({ ...photo, media_type: 'image/heic' })).statusCode).toBe(400)
    expect(beta).not.toHaveBeenCalled()
  })

  it('falls back to the stable call only when the fast params are rejected', async () => {
    beta.mockRejectedValue(Object.assign(new Error('output_config: unknown field'), { status: 400 }))
    stable.mockResolvedValue(reply('[]'))
    expect((await post(photo)).statusCode).toBe(200)
    expect(stable).toHaveBeenCalledTimes(1)
  })

  it('does not retry a timeout, and answers 504 with plain copy', async () => {
    beta.mockRejectedValue(Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' }))
    const res = await post(photo)
    expect(res.statusCode).toBe(504)
    expect(JSON.parse(res.body).error).toMatch(/took too long/)
    expect(stable).not.toHaveBeenCalled()
  })

  it('passes the model a timeout inside the 26s budget', async () => {
    beta.mockResolvedValue(reply('[]'))
    await post(photo)
    expect(beta.mock.calls[0][1].timeout).toBeLessThanOrEqual(26000)
  })
})
