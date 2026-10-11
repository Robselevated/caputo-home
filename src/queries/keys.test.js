import { describe, it, expect } from 'vitest'
import { keys, STALE } from './keys'

describe('query keys', () => {
  it('scopes every household list by household id', () => {
    for (const name of ['grocery', 'inventory', 'recentlyBought', 'itemHistory', 'recipes', 'recipeIngredients', 'mealPicks', 'members']) {
      expect(keys[name]('hh')[1]).toBe('hh')
      expect(STALE[name]).toBeGreaterThan(0)
    }
    expect(keys.recipe('r1')).toEqual(['recipe', 'r1'])
  })

  it('uses one inventory key for all locations so the Kitchen switcher is zero-network', () => {
    expect(keys.inventory('hh')).toEqual(['inventory', 'hh'])
    expect(keys.inventory('hh', 'pantry')).toEqual(['inventory', 'hh'])
  })
})
