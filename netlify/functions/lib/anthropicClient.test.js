// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { extractJson, callModel, MODEL } from './anthropicClient.js'
import { createDeadline } from './budget.js'

describe('extractJson', () => {
  it('parses plain, fenced and prose-wrapped JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Here you go: {"a":1} hope that helps')).toEqual({ a: 1 })
  })
  it('repairs trailing commas and a truncated tail', () => {
    expect(extractJson('{"a":[1,2,],}')).toEqual({ a: [1, 2] })
    expect(extractJson('{"name":"Soup","ingredients":[{"name":"onion","qty_text":"1"},{"name":"broth","qty_text":"6"')).toEqual({ name: 'Soup', ingredients: [{ name: 'onion', qty_text: '1' }, { name: 'broth', qty_text: '6' }] })
  })
  it('returns null for nothing usable', () => {
    expect(extractJson('')).toBeNull()
    expect(extractJson('no braces here')).toBeNull()
  })
})

describe('callModel', () => {
  it('uses Haiku, no retries, and a timeout inside the deadline', async () => {
    const create = vi.fn(async () => ({ content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn' }))
    const client = { messages: { create } }
    const d = createDeadline(20000)
    const res = await callModel(client, { system: 'sys', messages: [{ role: 'user', content: 'hi' }], max_tokens: 100 }, d)
    expect(res).toEqual({ text: '{"ok":true}', stop_reason: 'end_turn' })
    const [params, opts] = create.mock.calls[0]
    expect(params.model).toBe(MODEL)
    expect(params.system).toBe('sys')
    expect(opts.timeout).toBeLessThanOrEqual(18500)
    expect(opts.timeout).toBeGreaterThan(10000)
  })
  it('refuses to start with under three seconds left', async () => {
    let t = 0
    const d = createDeadline(5000, () => t)
    t = 3000
    const create = vi.fn()
    await expect(callModel({ messages: { create } }, { messages: [] }, d)).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(create).not.toHaveBeenCalled()
  })
})
