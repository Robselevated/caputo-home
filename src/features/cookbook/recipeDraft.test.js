import { describe, it, expect } from 'vitest'
import { applyParsed, emptyDraft, emptyIngredient } from './recipeDraft'

const parsed = {
  name: 'Lemon chicken',
  description: 'Weeknight roast',
  servings: 4,
  prep_time: 10,
  cook_time: 40,
  tags: ['chicken', 'quick'],
  instructions: '1. Roast.',
  image_url: 'https://x/dish.jpg',
  ingredients: [
    { section: null, name: 'chicken thighs', qty: 2, qty_text: '2', unit: 'lb', notes: null },
    { section: null, name: 'lemon', qty: 1, qty_text: '1', unit: null, notes: 'juiced' },
  ],
}

describe('applyParsed', () => {
  it('fills an empty draft completely and replaces the blank starter row', () => {
    const next = applyParsed(emptyDraft(), parsed)
    expect(next).toMatchObject({ name: 'Lemon chicken', description: 'Weeknight roast', servings: '4', prepTime: '10', cookTime: '40', tags: 'chicken, quick', instructions: '1. Roast.', imageUrl: 'https://x/dish.jpg' })
    expect(next.ingredients).toEqual([
      { name: 'chicken thighs', qty: '2', unit: 'lb', notes: '', section: '' },
      { name: 'lemon', qty: '1', unit: '', notes: 'juiced', section: '' },
    ])
  })

  it('appends scanned ingredients after rows the user already typed', () => {
    const draft = { ...emptyDraft(), ingredients: [{ name: 'olive oil', qty: '2', unit: 'tbsp', notes: '', section: '' }, emptyIngredient()] }
    const next = applyParsed(draft, parsed)
    expect(next.ingredients.map(i => i.name)).toEqual(['olive oil', 'chicken thighs', 'lemon'])
  })

  it('replaces the rows only when every existing row is empty', () => {
    const draft = { ...emptyDraft(), ingredients: [emptyIngredient(), emptyIngredient('Sauce')] }
    const next = applyParsed(draft, parsed)
    expect(next.ingredients.map(i => i.name)).toEqual(['chicken thighs', 'lemon'])
  })

  it('keeps the typed name when the scan has none', () => {
    const draft = { ...emptyDraft(), name: 'Nana chicken' }
    expect(applyParsed(draft, { ...parsed, name: null }).name).toBe('Nana chicken')
    expect(applyParsed(draft, { ...parsed, name: '' }).name).toBe('Nana chicken')
  })

  it('fills only the fields that are still empty', () => {
    const draft = { ...emptyDraft(), name: 'Nana chicken', servings: '6', instructions: 'My way.', tags: 'family' }
    const next = applyParsed(draft, parsed)
    expect(next.name).toBe('Nana chicken')
    expect(next.servings).toBe('6')
    expect(next.instructions).toBe('My way.')
    expect(next.tags).toBe('family')
    expect(next.description).toBe('Weeknight roast')
    expect(next.prepTime).toBe('10')
  })

  it('leaves the draft alone when the scan found nothing', () => {
    const draft = { ...emptyDraft(), name: 'Nana chicken', ingredients: [{ name: 'salt', qty: '', unit: '', notes: '', section: '' }] }
    const next = applyParsed(draft, { name: null, ingredients: [] })
    expect(next).toEqual(draft)
  })
})
