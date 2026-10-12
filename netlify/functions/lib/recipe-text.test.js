// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { parseRecipeFromText } from './recipe-text.js'
import { createDeadline } from './budget.js'
import { NO_RECIPE_TEXT as NO_RECIPE, NO_INGREDIENTS_TEXT as NO_INGREDIENTS, TOO_LONG, TOO_SLOW, UNREADABLE } from './contract.js'
import { RECIPE_TEXT_PROMPT } from './prompts.js'

const PASTE = `Grandma's pancakes
Ingredients
2 cups flour
1 tsp salt
3 eggs
Instructions
1. Whisk everything together.
2. Cook on a hot griddle.`

const modelReply = (obj, stop_reason = 'end_turn') => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason })
const rawReply = (text, stop_reason = 'end_turn') => ({ content: [{ type: 'text', text }], stop_reason })

function deps(create = vi.fn(), overrides = {}) {
  return { client: { messages: { create } }, deadline: createDeadline(50000), ...overrides }
}

describe('parseRecipeFromText', () => {
  it('sends the text to the model once and normalises the reply with qty_text rows', async () => {
    const create = vi.fn(async () => modelReply({
      name: 'Pancakes',
      ingredients: [{ name: 'flour', qty_text: '2', unit: 'cups' }, { name: 'salt', qty_text: '1', unit: 'tsp' }, { name: 'eggs', qty_text: '3' }],
      instructions: ['Whisk everything together.', 'Cook on a hot griddle.'],
    }))
    const { status, body } = await parseRecipeFromText(PASTE, deps(create))
    expect(status).toBe(200)
    expect(create).toHaveBeenCalledTimes(1)
    const [params] = create.mock.calls[0]
    expect(params.system).toBe(RECIPE_TEXT_PROMPT)
    expect(params.messages).toEqual([{ role: 'user', content: PASTE }])
    expect(params.max_tokens).toBe(4096)
    expect(body).toMatchObject({ name: 'Pancakes', via: 'text', source_url: null, instructions: '1. Whisk everything together.\n2. Cook on a hot griddle.' })
    expect(body.ingredients).toEqual([
      { section: null, name: 'flour', qty: 2, qty_text: '2', unit: 'cup', notes: null },
      { section: null, name: 'salt', qty: 1, qty_text: '1', unit: 'tsp', notes: null },
      { section: null, name: 'eggs', qty: 3, qty_text: '3', unit: null, notes: null },
    ])
  })

  it('rejects empty or whitespace-only text before any model call', async () => {
    const d = deps()
    for (const text of ['', '   \n\t ', null, undefined]) {
      const { status, body } = await parseRecipeFromText(text, d)
      expect(status).toBe(400)
      expect(body.error).toBe('Paste some recipe text first.')
    }
    expect(d.client.messages.create).not.toHaveBeenCalled()
  })

  it('refuses text over 30,000 characters without calling the model', async () => {
    const d = deps()
    const { status, body } = await parseRecipeFromText('x'.repeat(30001), d)
    expect(status).toBe(422)
    expect(body.error).toBe(TOO_LONG)
    expect(d.client.messages.create).not.toHaveBeenCalled()
    const ok = vi.fn(async () => modelReply({ name: 'Edge', ingredients: [{ name: 'salt', qty_text: '1' }] }))
    expect((await parseRecipeFromText('x'.repeat(30000), deps(ok))).status).toBe(200)
  })

  it('answers 422 when the model finds no recipe in the text', async () => {
    const empty = vi.fn(async () => modelReply({ name: null, ingredients: [] }))
    expect(await parseRecipeFromText('Just some notes about my weekend.', deps(empty))).toEqual({ status: 422, body: { error: NO_RECIPE } })
    const prose = vi.fn(async () => rawReply('Sorry, I cannot see a recipe in that text.'))
    expect(await parseRecipeFromText('Just some notes about my weekend.', deps(prose))).toEqual({ status: 422, body: { error: NO_RECIPE } })
  })

  it('answers 422 when there is a name but no ingredients, and too long when the reply was cut off', async () => {
    const nameOnly = vi.fn(async () => modelReply({ name: 'Mystery dish', ingredients: [] }))
    expect(await parseRecipeFromText('Mystery dish, serves 4', deps(nameOnly))).toEqual({ status: 422, body: { error: NO_INGREDIENTS } })
    const cut = vi.fn(async () => rawReply('{"name": "Long', 'max_tokens'))
    expect(await parseRecipeFromText('a very long recipe', deps(cut))).toEqual({ status: 422, body: { error: TOO_LONG } })
  })

  it('answers 504 when the budget is gone or the model call times out, 502 for anything else', async () => {
    const spent = deps(vi.fn(), { deadline: createDeadline(1000) })
    expect(await parseRecipeFromText(PASTE, spent)).toEqual({ status: 504, body: { error: TOO_SLOW } })
    expect(spent.client.messages.create).not.toHaveBeenCalled()

    const slow = vi.fn(async () => { const e = new Error('Request timed out.'); e.name = 'APIConnectionTimeoutError'; throw e })
    expect(await parseRecipeFromText(PASTE, deps(slow))).toEqual({ status: 504, body: { error: TOO_SLOW } })

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = vi.fn(async () => { throw new Error('overloaded') })
    expect(await parseRecipeFromText(PASTE, deps(broken))).toEqual({ status: 502, body: { error: UNREADABLE } })
    spy.mockRestore()
  })
})
