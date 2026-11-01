import { describe, it, expect } from 'vitest'
import { mealTypeOf, withMealType, keepMealType } from './mealType'

const r = (name, tags = []) => ({ name, tags })

describe('mealTypeOf', () => {
  it('uses an explicit meal type tag first', () => {
    expect(mealTypeOf(r('Chili', ['Side']))).toBe('side')
    expect(mealTypeOf(r('S\'mores Cups', ['American', 'Dessert']))).toBe('dessert')
  })

  it('treats a recipe tagged for several meals as dinner', () => {
    expect(mealTypeOf(r('Loco Moco', ['breakfast', 'lunch', 'dinner']))).toBe('dinner')
  })

  it('guesses from tags, with main course beating side words', () => {
    expect(mealTypeOf(r('Pico de Gallo', ['Appetizer']))).toBe('side')
    expect(mealTypeOf(r('Poblano Tacos', ['main course', 'avocado salsa']))).toBe('dinner')
    expect(mealTypeOf(r('Wings', ['sweet and sour']))).toBe('dinner')
  })

  it('falls back to the name, then to dinner', () => {
    expect(mealTypeOf(r('Simple and Easy Apple Dumplings'))).toBe('dessert')
    expect(mealTypeOf(r('Chicken Chimichangas'))).toBe('dinner')
  })
})

describe('withMealType / keepMealType', () => {
  it('replaces any meal type tag with the chosen one, keeping the rest', () => {
    expect(withMealType(['dinner', 'Mexican', 'Breakfast'], 'side')).toEqual(['Side', 'Mexican'])
  })

  it('a re-import keeps the type the cook chose', () => {
    expect(keepMealType(['Dessert', 'old'], ['main course', 'new'])).toEqual(['Dessert', 'main course', 'new'])
    expect(keepMealType(['old'], ['new'])).toEqual(['new'])
  })
})
