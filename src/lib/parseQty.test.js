import { describe, it, expect } from 'vitest'
import { parseQty, normalizeIngredientQty } from './parseQty'

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

describe('normalizeIngredientQty', () => {
  it('converts a fraction and leaves notes alone', () => {
    expect(normalizeIngredientQty({ name: 'flour', qty: '1/2', notes: null }))
      .toEqual({ name: 'flour', qty: 0.5, notes: null })
  })

  it('stashes non-numeric quantity text into notes', () => {
    expect(normalizeIngredientQty({ name: 'salt', qty: 'to taste', notes: null }))
      .toEqual({ name: 'salt', qty: null, notes: 'to taste' })
  })

  it('appends leftover to existing notes', () => {
    expect(normalizeIngredientQty({ name: 'salt', qty: 'to taste', notes: 'fine grain' }))
      .toEqual({ name: 'salt', qty: null, notes: 'fine grain (to taste)' })
  })
})
