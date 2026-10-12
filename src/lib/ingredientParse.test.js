import { describe, it, expect } from 'vitest'
import { parseIngredientLine, parseIngredientText, parseIngredientRows, normalizeUnit, formatQty } from './ingredientParse'

const row = (o) => ({ qty: null, qty_text: '', unit: '', unit_text: '', notes: '', section: '', ...o })

describe('parseIngredientLine', () => {
  it.each([
    ['8 oz cream cheese, softened', row({ name: 'cream cheese', qty: 8, qty_text: '8', unit: 'oz', unit_text: 'oz', notes: 'softened' })],
    ['1 (15 oz) can black beans', row({ name: 'black beans', qty: 1, qty_text: '1', unit: 'can', unit_text: 'can', notes: '15 oz' })],
    ['1 can (14.5 oz) diced tomatoes', row({ name: 'diced tomatoes', qty: 1, qty_text: '1', unit: 'can', unit_text: 'can', notes: '14.5 oz' })],
    ['2 lbs boneless, skinless chicken thighs', row({ name: 'boneless, skinless chicken thighs', qty: 2, qty_text: '2', unit: 'lb', unit_text: 'lbs' })],
    ['½ cup olive oil', row({ name: 'olive oil', qty: 0.5, qty_text: '½', unit: 'cup', unit_text: 'cup' })],
    ['1½ cups milk', row({ name: 'milk', qty: 1.5, qty_text: '1½', unit: 'cup', unit_text: 'cups' })],
    ['1 1/2 cups flour', row({ name: 'flour', qty: 1.5, qty_text: '1 1/2', unit: 'cup', unit_text: 'cups' })],
    ['1-2 jalapeños, seeded', row({ name: 'jalapeños', qty: 1, qty_text: '1-2', notes: 'seeded' })],
    ['1 to 2 tbsp honey', row({ name: 'honey', qty: 1, qty_text: '1 to 2', unit: 'tbsp', unit_text: 'tbsp' })],
    ['Salt and pepper to taste', row({ name: 'Salt and pepper', qty_text: 'to taste' })],
    ['**2 tbsp** butter', row({ name: 'butter', qty: 2, qty_text: '2', unit: 'tbsp', unit_text: 'tbsp' })],
    ['- 1 cup rice', row({ name: 'rice', qty: 1, qty_text: '1', unit: 'cup', unit_text: 'cup' })],
    ['Juice of 1 lemon', row({ name: 'Juice of 1 lemon' })],
    ['3 garlic cloves, minced', row({ name: 'garlic cloves', qty: 3, qty_text: '3', notes: 'minced' })],
    ['400g spaghetti', row({ name: 'spaghetti', qty: 400, qty_text: '400', unit: 'g', unit_text: 'g' })],
    ['2 Tbsp. soy sauce', row({ name: 'soy sauce', qty: 2, qty_text: '2', unit: 'tbsp', unit_text: 'Tbsp' })],
    ['1/4 tsp cayenne (optional)', row({ name: 'cayenne', qty: 0.25, qty_text: '1/4', unit: 'tsp', unit_text: 'tsp', notes: 'optional' })],
    ['2x eggs', row({ name: 'eggs', qty: 2, qty_text: '2' })],
    ['a pinch of nutmeg', row({ name: 'nutmeg', qty_text: 'pinch' })],
    ['4 fl oz heavy cream', row({ name: 'heavy cream', qty: 4, qty_text: '4', unit: 'fl oz', unit_text: 'fl oz' })],
    ['3 eggs', row({ name: 'eggs', qty: 3, qty_text: '3' })],
  ])('%s', (line, expected) => {
    expect(parseIngredientLine(line)).toEqual(expected)
  })

  it('returns a section for header lines and carries the current section onto rows', () => {
    expect(parseIngredientLine('For the sauce:')).toEqual({ section: 'For the sauce' })
    expect(parseIngredientLine('Sauce:')).toEqual({ section: 'Sauce' })
    expect(parseIngredientLine('2 cups rice', { section: 'Sauce' })).toMatchObject({ name: 'rice', section: 'Sauce' })
  })

  it('returns an instruction for step-like lines instead of an ingredient', () => {
    expect(parseIngredientLine('1. Preheat the oven to 400°F and line a sheet pan with foil.')).toEqual({ instruction: 'Preheat the oven to 400°F and line a sheet pan with foil.' })
    expect(parseIngredientLine('Whisk the eggs with the milk until smooth, then set aside for ten minutes.')).toEqual({ instruction: 'Whisk the eggs with the milk until smooth, then set aside for ten minutes.' })
  })

  it('returns null for blank lines', () => {
    expect(parseIngredientLine('')).toBeNull()
    expect(parseIngredientLine('   ')).toBeNull()
  })
})

describe('parseIngredientText', () => {
  it('splits a pasted recipe into sectioned ingredients and instructions', () => {
    const text = `Ingredients
For the chicken:
2 lbs chicken thighs
1 tsp salt
For the sauce:
1/2 cup soy sauce
Instructions
1. Season the chicken all over with the salt and let it sit.
2. Whisk the soy sauce in a bowl and pour it over.`
    const out = parseIngredientText(text)
    expect(out.ingredients.map(i => [i.name, i.section])).toEqual([
      ['chicken thighs', 'For the chicken'], ['salt', 'For the chicken'], ['soy sauce', 'For the sauce'],
    ])
    expect(out.instructions).toEqual([
      'Season the chicken all over with the salt and let it sit.',
      'Whisk the soy sauce in a bowl and pour it over.',
    ])
  })
})

describe('parseIngredientRows', () => {
  it('gives the editor rows with the quantity and unit as typed', () => {
    expect(parseIngredientRows('1/2 cup sugar\nFor the glaze:\n2 Tbsp. butter')).toEqual([
      { name: 'sugar', qty: '1/2', unit: 'cup', notes: '', section: '' },
      { name: 'butter', qty: '2', unit: 'Tbsp', notes: '', section: 'For the glaze' },
    ])
  })
})

describe('normalizeUnit', () => {
  it.each([
    ['cups', 'cup'], ['Cup', 'cup'], ['c', 'cup'], ['T', 'tbsp'], ['Tbsp.', 'tbsp'], ['tablespoons', 'tbsp'], ['t', 'tsp'],
    ['teaspoon', 'tsp'], ['oz', 'oz'], ['ounces', 'oz'], ['fl oz', 'fl oz'], ['lbs', 'lb'], ['pound', 'lb'], ['g', 'g'],
    ['grams', 'g'], ['kg', 'kg'], ['ml', 'ml'], ['liters', 'l'], ['qt', 'quart'], ['pints', 'pint'], ['cans', 'can'],
    ['pkg', 'package'], ['packages', 'package'], ['envelope', 'envelope'], ['jars', 'jar'], ['bottle', 'bottle'],
    ['boxes', 'box'], ['bags', 'bag'], ['sticks', 'stick'], ['pieces', 'piece'], ['heads', 'head'], ['pinch', 'pinch'],
    ['cloves', 'clove'], ['slices', 'slice'], ['bunches', 'bunch'], ['large', null], ['chicken', null], ['', null],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUnit(input)).toBe(expected)
  })
})

describe('formatQty', () => {
  it.each([[2, '2'], [0.5, '1/2'], [1.5, '1 1/2'], [0.333, '1/3'], [0.667, '2/3'], [0.25, '1/4'], [0.75, '3/4'], [0.125, '1/8'], [2.4, '2.4'], [null, '']])('%s -> %s', (n, s) => {
    expect(formatQty(n)).toBe(s)
  })
})
