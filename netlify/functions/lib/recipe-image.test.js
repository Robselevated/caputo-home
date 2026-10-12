// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { parseRecipeFromImages, imagesFromBody, NO_RECIPE_IN_PHOTOS, TOO_MANY_PHOTOS } from './recipe-image.js'
import { RECIPE_IMAGE_PROMPT } from './prompts.js'
import { TOO_LONG, NO_INGREDIENTS } from './contract.js'
import { createDeadline } from './budget.js'

const modelReply = (obj, stop_reason = 'end_turn') => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], stop_reason })
const img = (n) => ({ base64: `data${n}`, media_type: 'image/png' })
const images = (n) => Array.from({ length: n }, (_, i) => img(i))

function deps(reply, overrides = {}) {
  const create = vi.fn(async () => reply)
  return { client: { messages: { create } }, deadline: createDeadline(50000), create, ...overrides }
}

const GOOD = {
  name: 'Lemon Garlic Chicken Thighs',
  servings: 4,
  instructions: ['Preheat the oven.', 'Roast 40 minutes.'],
  ingredients: [
    { name: 'chicken thighs', qty_text: '2', qty: 2, unit: 'lb' },
    { name: 'garlic', qty_text: '4', qty: 4, unit: 'clove', notes: 'minced' },
    { name: 'salt', qty_text: 'to taste' },
  ],
}

describe('parseRecipeFromImages', () => {
  it('makes one model call with one image block per photo and the prompt text last', async () => {
    const d = deps(modelReply(GOOD))
    const { status, body } = await parseRecipeFromImages(images(3), d)
    expect(status).toBe(200)
    expect(d.create).toHaveBeenCalledTimes(1)
    const [params] = d.create.mock.calls[0]
    expect(params.system).toBe(RECIPE_IMAGE_PROMPT)
    expect(params.max_tokens).toBe(6000)
    expect(params.messages).toHaveLength(1)
    const content = params.messages[0].content
    expect(content).toHaveLength(4)
    expect(content.slice(0, 3)).toEqual([0, 1, 2].map(i => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: `data${i}` } })))
    expect(content[3]).toEqual({ type: 'text', text: 'Read the recipe in these images.' })
    expect(body.via).toBe('image')
  })

  it('returns the normalised contract with qty_text on every row', async () => {
    const { status, body } = await parseRecipeFromImages(images(1), deps(modelReply(GOOD)))
    expect(status).toBe(200)
    expect(body).toMatchObject({ name: 'Lemon Garlic Chicken Thighs', servings: 4, via: 'image', source_url: null, instructions: '1. Preheat the oven.\n2. Roast 40 minutes.' })
    expect(body.ingredients).toEqual([
      { section: null, name: 'chicken thighs', qty: 2, qty_text: '2', unit: 'lb', notes: null },
      { section: null, name: 'garlic', qty: 4, qty_text: '4', unit: 'clove', notes: 'minced' },
      { section: null, name: 'salt', qty: null, qty_text: 'to taste', unit: null, notes: null },
    ])
    expect(body._partial).toBeUndefined()
  })

  it('accepts legacy url items as url image sources', async () => {
    const d = deps(modelReply(GOOD))
    await parseRecipeFromImages([{ type: 'url', url: 'https://cdn.test/a.jpg' }], d)
    expect(d.create.mock.calls[0][0].messages[0].content[0]).toEqual({ type: 'image', source: { type: 'url', url: 'https://cdn.test/a.jpg' } })
  })

  it('refuses more than six photos before calling the model', async () => {
    const d = deps(modelReply(GOOD))
    const { status, body } = await parseRecipeFromImages(images(7), d)
    expect(status).toBe(422)
    expect(body.error).toBe(TOO_MANY_PHOTOS)
    expect(body.error).toBe('Send at most 6 photos at a time.')
    expect(d.create).not.toHaveBeenCalled()
  })

  it('rejects an empty list and an unsupported media type with 400', async () => {
    const d = deps(modelReply(GOOD))
    expect((await parseRecipeFromImages([], d)).status).toBe(400)
    expect((await parseRecipeFromImages([{ base64: 'x', media_type: 'image/heic' }], d)).status).toBe(400)
    expect(d.create).not.toHaveBeenCalled()
  })

  it('turns a cut-off reply into 422 too long, never a partial 200', async () => {
    const { status, body } = await parseRecipeFromImages(images(2), deps(modelReply(GOOD, 'max_tokens')))
    expect(status).toBe(422)
    expect(body.error).toBe(TOO_LONG)
  })

  it('turns a reply with no JSON into 422 could not read', async () => {
    const { status, body } = await parseRecipeFromImages(images(1), deps(modelReply('Sorry, I cannot see a recipe here.')))
    expect(status).toBe(422)
    expect(body.error).toBe(NO_RECIPE_IN_PHOTOS)
    expect(body.error).toBe('We could not read a recipe in those photos.')
  })

  it('treats no name and no ingredients as no recipe, and a name alone as no ingredients', async () => {
    expect(await parseRecipeFromImages(images(1), deps(modelReply({ name: null, ingredients: [] })))).toEqual({ status: 422, body: { error: NO_RECIPE_IN_PHOTOS } })
    expect(await parseRecipeFromImages(images(1), deps(modelReply({ name: 'Soup', ingredients: [] })))).toEqual({ status: 422, body: { error: NO_INGREDIENTS } })
  })

  it('answers 504 when the budget has run out', async () => {
    let t = 0
    const deadline = createDeadline(5000, () => t)
    t = 4000
    const d = deps(modelReply(GOOD), { deadline })
    const { status, body } = await parseRecipeFromImages(images(1), d)
    expect(status).toBe(504)
    expect(body.error).toMatch(/too long/)
    expect(d.create).not.toHaveBeenCalled()
  })

  it('answers 502 with a photo message on an unexpected model error', async () => {
    const create = vi.fn(async () => { throw new Error('boom') })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { status, body } = await parseRecipeFromImages(images(1), { client: { messages: { create } }, deadline: createDeadline(50000) })
    spy.mockRestore()
    expect(status).toBe(502)
    expect(body.error).toMatch(/photos/)
  })
})

describe('imagesFromBody', () => {
  it('passes an images array through and maps the three legacy shapes onto it', () => {
    expect(imagesFromBody({ images: [img(0)] })).toEqual([img(0)])
    expect(imagesFromBody({ image_base64: 'abc', media_type: 'image/jpeg' })).toEqual([{ base64: 'abc', media_type: 'image/jpeg' }])
    expect(imagesFromBody({ image_url: 'https://x/a.jpg' })).toEqual([{ type: 'url', url: 'https://x/a.jpg' }])
    expect(imagesFromBody({ image_urls: ['https://x/a.jpg', 'https://x/b.jpg'] })).toEqual([{ type: 'url', url: 'https://x/a.jpg' }, { type: 'url', url: 'https://x/b.jpg' }])
    expect(imagesFromBody({})).toEqual([])
  })
})
