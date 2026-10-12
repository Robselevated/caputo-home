import { describe, it, expect } from 'vitest'
import { unitFamily, convertQty } from './units'

describe('unitFamily', () => {
  it.each([
    ['oz', 'weight'], ['ounces', 'weight'], ['lb', 'weight'], ['lbs', 'weight'], ['g', 'weight'], ['kg', 'weight'],
    ['tsp', 'volume'], ['tbsp', 'volume'], ['fl oz', 'volume'], ['cup', 'volume'], ['cups', 'volume'],
    ['pint', 'volume'], ['quart', 'volume'], ['gallon', 'volume'], ['ml', 'volume'], ['l', 'volume'],
    ['can', 'count'], ['cans', 'count'], ['package', 'count'], ['clove', 'count'], ['count', 'count'], ['bags', 'count'],
  ])('%s is %s', (unit, family) => {
    expect(unitFamily(unit)).toBe(family)
  })

  it('is null for blank or unknown units', () => {
    expect(unitFamily('')).toBeNull()
    expect(unitFamily(null)).toBeNull()
    expect(unitFamily(undefined)).toBeNull()
    expect(unitFamily('smidgen')).toBeNull()
  })
})

describe('convertQty', () => {
  it.each([
    [16, 'oz', 'lb', 1],
    [1, 'lb', 'oz', 16],
    [1, 'kg', 'g', 1000],
    [1000, 'g', 'kg', 1],
    [1, 'lb', 'g', 453.592],
    [3, 'tsp', 'tbsp', 1],
    [1, 'tbsp', 'tsp', 3],
    [16, 'tbsp', 'cup', 1],
    [1, 'cup', 'fl oz', 8],
    [2, 'cups', 'pint', 1],
    [2, 'pint', 'quart', 1],
    [4, 'quart', 'gallon', 1],
    [1, 'l', 'ml', 1000],
    [1, 'cup', 'ml', 236.588],
  ])('%s %s is %s %s', (qty, from, to, expected) => {
    expect(convertQty(qty, from, to)).toBeCloseTo(expected, 2)
  })

  it('returns the amount unchanged when the units are the same', () => {
    expect(convertQty(2, 'cups', 'cup')).toBe(2)
    expect(convertQty(3, 'cans', 'can')).toBe(3)
    expect(convertQty(1, 'lbs', 'lb')).toBe(1)
  })

  it('is null across families or for unknown units', () => {
    expect(convertQty(8, 'oz', 'cup')).toBeNull()
    expect(convertQty(1, 'cup', 'g')).toBeNull()
    expect(convertQty(1, 'oz', 'package')).toBeNull()
    expect(convertQty(1, 'can', 'box')).toBeNull()
    expect(convertQty(1, 'smidgen', 'tsp')).toBeNull()
    expect(convertQty(1, 'tsp', '')).toBeNull()
    expect(convertQty(1, null, 'tsp')).toBeNull()
  })

  it('is null for a missing amount', () => {
    expect(convertQty(null, 'oz', 'lb')).toBeNull()
    expect(convertQty(undefined, 'oz', 'lb')).toBeNull()
    expect(convertQty('abc', 'oz', 'lb')).toBeNull()
  })
})
