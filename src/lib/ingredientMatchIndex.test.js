import { describe, it, expect, vi } from 'vitest'
import { matchScore, hasMatch, buildInventoryIndex, internals } from './ingredientMatch'

describe('buildInventoryIndex', () => {
  const NAMES = [
    'rice', 'brown rice', 'rice vinegar', 'all-purpose flour', 'graham crackers', 'green onions',
    'scallions', 'cilantro', 'heavy whipping cream', 'yellow onion', 'red onion', 'brown sugar',
    'white sugar', 'sugar', 'sweet potato', 'potatoes', 'chili oil', 'olive oil', 'extra-virgin olive oil',
    'eggs', 'garlic', 'parmesan', 'cheddar cheese', 'mozzarella', 'black pepper', 'ground cumin',
    'cumin', 'lemon', 'lime juice', 'corn starch', 'soy sauce', 'ham', 'fresh', 'rice, brown',
    'cherry tomatoes', 'tomato', 'baking soda', 'bicarbonate of soda', 'dark chocolate', 'chocolate',
  ]

  it('gives the same answer as matching against the plain set of names', () => {
    for (let i = 0; i < NAMES.length; i++) {
      const inventory = new Set(NAMES.filter((_, j) => j % 3 === i % 3 || j === i + 1))
      const index = buildInventoryIndex(inventory)
      for (const ingredient of [...NAMES, 'pepper', 'coriander', 'heavy cream', 'onion', 'egg', 'flour', '']) {
        const brute = [...inventory].some(inv => matchScore(ingredient, inv) > 0)
        expect(hasMatch(ingredient, index), `${ingredient} vs [${[...inventory]}]`).toBe(brute)
      }
    }
  })

  it('tokenizes each inventory item once, however many ingredients are checked', () => {
    const inventory = Array.from({ length: 500 }, (_, i) => `item ${i} flour`)
    const spy = vi.spyOn(internals, 'tokenize')
    try {
      const index = buildInventoryIndex(inventory)
      expect(spy).toHaveBeenCalledTimes(500)
      spy.mockClear()
      const ingredients = Array.from({ length: 200 }, (_, i) => `ingredient ${i}`)
      for (const name of ingredients) hasMatch(name, index)
      expect(spy).toHaveBeenCalledTimes(200)
    } finally {
      spy.mockRestore()
    }
  })
})
