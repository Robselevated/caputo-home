// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { parseRecipeFromUrl } from './recipe-url.js'
import { createDeadline } from './budget.js'

const LD_PAGE = '<html><head><meta property="og:image" content="https://x/og.jpg"><script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeIngredient":["1 onion","6 cups broth"],"recipeInstructions":"Simmer."}</script></head><body></body></html>'
const PLAIN_PAGE = '<html><body><h1>Grandma soup</h1>' + '<p>story</p>'.repeat(50) + '<h2>Ingredients</h2><ul><li>1 onion</li><li>6 cups broth</li></ul><h2>Instructions</h2><p>Simmer.</p></body></html>'
const resp = (status, body, url) => ({ ok: status >= 200 && status < 300, status, url, text: async () => body, json: async () => JSON.parse(body) })
const modelReply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn' })

function deps(overrides = {}) {
  return { fetchImpl: vi.fn(), client: { messages: { create: vi.fn() } }, deadline: createDeadline(50000), firecrawlKey: 'k', ...overrides }
}

describe('parseRecipeFromUrl', () => {
  it('returns structured data without touching the model', async () => {
    const d = deps({ fetchImpl: vi.fn(async () => resp(200, LD_PAGE, 'https://blog.test/soup')) })
    const { status, body } = await parseRecipeFromUrl('https://blog.test/soup', d)
    expect(status).toBe(200)
    expect(body).toMatchObject({ name: 'Soup', via: 'jsonld', source_url: 'https://blog.test/soup', image_url: 'https://x/og.jpg' })
    expect(body.ingredients[1]).toEqual({ section: null, name: 'broth', qty: 6, qty_text: '6', unit: 'cup', notes: null })
    expect(d.client.messages.create).not.toHaveBeenCalled()
  })

  it('sends only the recipe region of a plain page to the model and normalises the reply', async () => {
    const create = vi.fn(async () => modelReply({ name: 'Grandma soup', ingredients: [{ name: 'onion', qty_text: '1' }, { name: 'broth', qty_text: '6', unit: 'cups' }], instructions: '1. Simmer.' }))
    const d = deps({ fetchImpl: vi.fn(async () => resp(200, PLAIN_PAGE, 'https://blog.test/plain')), client: { messages: { create } } })
    const { status, body } = await parseRecipeFromUrl('https://blog.test/plain', d)
    expect(status).toBe(200)
    expect(body.via).toBe('model')
    const sent = create.mock.calls[0][0].messages[0].content
    expect(sent).toContain('Ingredients')
    expect(sent).not.toContain('<li>')
    expect(body.ingredients[1]).toEqual({ section: null, name: 'broth', qty: 6, qty_text: '6', unit: 'cup', notes: null })
  })

  it('follows a Pinterest pin to its source page', async () => {
    const widget = JSON.stringify({ data: [{ id: '42', link: 'https://blog.test/soup', description: 'd', images: {} }] })
    const fetchImpl = vi.fn(async (url) => url.includes('pidgets') ? resp(200, widget, url) : resp(200, LD_PAGE, 'https://blog.test/soup'))
    const d = deps({ fetchImpl })
    const { status, body } = await parseRecipeFromUrl('https://www.pinterest.com/pin/42/', d)
    expect(status).toBe(200)
    expect(body).toMatchObject({ name: 'Soup', source_url: 'https://blog.test/soup', via: 'jsonld' })
  })

  it('uses the pin description when a pin has no source link', async () => {
    const widget = JSON.stringify({ data: [{ id: '42', description: 'Lemon chicken: 2 lbs thighs, 1 lemon. Roast 40 min.', images: { '564x': { url: 'https://i/pin.jpg' } } }] })
    const create = vi.fn(async () => modelReply({ name: 'Lemon chicken', ingredients: [{ name: 'thighs', qty_text: '2', unit: 'lbs' }], instructions: '1. Roast.' }))
    const d = deps({ fetchImpl: vi.fn(async (url) => resp(200, widget, url)), client: { messages: { create } } })
    const { status, body } = await parseRecipeFromUrl('https://www.pinterest.com/pin/42/', d)
    expect(status).toBe(200)
    expect(body).toMatchObject({ via: 'pinterest', image_url: 'https://i/pin.jpg' })
    expect(create.mock.calls[0][0].messages[0].content).toContain('2 lbs thighs')
  })

  it('refuses blocked sites and private addresses before any fetch', async () => {
    const d = deps()
    expect((await parseRecipeFromUrl('https://www.allrecipes.com/recipe/1/', d)).status).toBe(422)
    expect((await parseRecipeFromUrl('http://127.0.0.1/x', d)).status).toBe(400)
    expect(d.fetchImpl).not.toHaveBeenCalled()
  })

  it('answers 504 when the budget runs out', async () => {
    let t = 0
    const deadline = createDeadline(5000, () => t)
    const fetchImpl = vi.fn(async () => { t += 6000; return resp(200, PLAIN_PAGE, 'https://blog.test/slow') })
    const { status, body } = await parseRecipeFromUrl('https://blog.test/slow', deps({ fetchImpl, deadline }))
    expect(status).toBe(504)
    expect(body.error).toMatch(/too long/)
  })
})
