// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeContract } from './contract.js'

describe('normalizeContract', () => {
  it('keeps the amount and the unit apart even when the model merges them', () => {
    const r = normalizeContract({ name: 'X', ingredients: [
      { name: 'chicken thighs', qty_text: '2 pounds', unit: 'lb' },
      { name: 'garlic', qty_text: '4 cloves' },
      { name: 'olive oil', qty_text: '3 tablespoons', unit: 'tbsp', qty: 3 },
      { name: 'salt', qty_text: 'to taste' },
    ] })
    expect(r.ingredients).toEqual([
      { section: null, name: 'chicken thighs', qty: 2, qty_text: '2', unit: 'lb', notes: null },
      { section: null, name: 'garlic', qty: 4, qty_text: '4', unit: 'clove', notes: null },
      { section: null, name: 'olive oil', qty: 3, qty_text: '3', unit: 'tbsp', notes: null },
      { section: null, name: 'salt', qty: null, qty_text: 'to taste', unit: null, notes: null },
    ])
  })
  it('coerces servings and times, drops bad image urls, numbers array instructions', () => {
    const r = normalizeContract({ name: ' Soup ', servings: '4', prep_time: 10.4, cook_time: '20', image_url: 'not a url', instructions: ['Chop.', '2. Simmer.'], tags: ['a', '', 'b'] }, { sourceUrl: 'https://x/y', via: 'model', fallbackImage: 'https://x/og.jpg' })
    expect(r).toMatchObject({ name: 'Soup', servings: 4, prep_time: null, cook_time: 20, image_url: 'https://x/og.jpg', instructions: '1. Chop.\n2. Simmer.', tags: ['a', 'b'], source_url: 'https://x/y', via: 'model' })
  })
})
