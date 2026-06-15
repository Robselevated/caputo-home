import { describe, it, expect } from 'vitest'
import { parseQty, normalizeIngredientQty, parseIngredientLine, parseIngredientBlock } from './parseQty'

describe('parseQty', () => {
  it('parses plain numbers', () => {
    expect(parseQty('2')).toEqual({ qty: 2, leftover: null })
    expect(parseQty('1.5')).toEqual({ qty: 1.5, leftover: null })
    expect(parseQty(3)).toEqual({ qty: 3, leftover: null })
  })

  it('parses simple and mixed fractions', () => {
    expect(parseQty('1/2')).toEqual({ qty: 0.5, leftover: null })
    expect(parseQty('3/4')).toEqual({ qty: 0.75, leftover: null })
    expect(parseQty('1 1/2')).toEqual({ qty: 1.5, leftover: null })
  })

  it('parses unicode fractions', () => {
    expect(parseQty('½')).toEqual({ qty: 0.5, leftover: null })
    expect(parseQty('1½')).toEqual({ qty: 1.5, leftover: null })
    expect(parseQty('¼')).toEqual({ qty: 0.25, leftover: null })
  })

  it('keeps non-numeric quantities as leftover text', () => {
    expect(parseQty('to taste')).toEqual({ qty: null, leftover: 'to taste' })
    expect(parseQty('a pinch')).toEqual({ qty: null, leftover: 'a pinch' })
    expect(parseQty('1-2')).toEqual({ qty: null, leftover: '1-2' })
  })

  it('splits a leading number from trailing text', () => {
    expect(parseQty('2 (or 3)')).toEqual({ qty: 2, leftover: '(or 3)' })
  })

  it('handles empty / null', () => {
    expect(parseQty('')).toEqual({ qty: null, leftover: null })
    expect(parseQty(null)).toEqual({ qty: null, leftover: null })
    expect(parseQty('   ')).toEqual({ qty: null, leftover: null })
  })
})

describe('parseIngredientLine', () => {
  it('splits qty, unit, name', () => {
    expect(parseIngredientLine('2 cups flour')).toEqual({ name: 'flour', qty: '2', unit: 'cups', notes: '', section: '' })
  })
  it('handles fractions and notes', () => {
    expect(parseIngredientLine('1/2 tsp salt, fine')).toEqual({ name: 'salt', qty: '1/2', unit: 'tsp', notes: 'fine', section: '' })
  })
  it('handles no-unit items', () => {
    expect(parseIngredientLine('3 eggs')).toEqual({ name: 'eggs', qty: '3', unit: '', notes: '', section: '' })
  })
  it('strips bullets / list numbers', () => {
    expect(parseIngredientLine('- 1 onion, diced')).toEqual({ name: 'onion', qty: '1', unit: '', notes: 'diced', section: '' })
  })
  it('puts an unparseable line entirely in name', () => {
    expect(parseIngredientLine('salt and pepper to taste')).toEqual({ name: 'salt and pepper to taste', qty: '', unit: '', notes: '', section: '' })
  })
})

describe('parseIngredientBlock', () => {
  it('parses a multi-line block, skipping blanks', () => {
    const rows = parseIngredientBlock('2 cups flour\n\n1/2 tsp salt\n3 eggs')
    expect(rows).toHaveLength(3)
    expect(rows[0].name).toBe('flour')
    expect(rows[2].name).toBe('eggs')
  })
})

describe('normalizeIngredientQty', () => {
  it('keeps a numeric qty for math and the verbatim text for display', () => {
    expect(normalizeIngredientQty({ name: 'flour', qty: '1/2', notes: null }))
      .toEqual({ name: 'flour', qty: 0.5, qty_text: '1/2', notes: null })
  })

  it('stores non-numeric quantities verbatim with qty null', () => {
    expect(normalizeIngredientQty({ name: 'salt', qty: 'to taste', notes: null }))
      .toEqual({ name: 'salt', qty: null, qty_text: 'to taste', notes: null })
  })

  it('maps an empty qty to null/null', () => {
    expect(normalizeIngredientQty({ name: 'salt', qty: '', notes: null }))
      .toEqual({ name: 'salt', qty: null, qty_text: null, notes: null })
  })
})
