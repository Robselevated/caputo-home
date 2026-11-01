import { describe, it, expect } from 'vitest'
import { buildShelves, lastMadeByRecipe } from './shelves'

const today = new Date(2026, 10, 2)
const r = (id, o = {}) => ({ id, name: id, tags: [], prep_time: null, cook_time: null, created_at: '2026-01-01T00:00:00Z', ...o })

describe('buildShelves', () => {
  it('fills each shelf by its rule and leaves empty shelves out', () => {
    const recipes = [
      r('Tacos', { prep_time: 10, cook_time: 15 }),
      r('Chili', { tags: ['Crockpot'], cook_time: 480 }),
      r('Pasta', { cook_time: 20, created_at: '2026-10-25T00:00:00Z' }),
      r('Soup'),
    ]
    const shelves = buildShelves(recipes, { readyIds: new Set(['Soup']), today })
    expect(shelves.map(s => s.key)).toEqual(['ready', 'quick', 'slow', 'new'])
    expect(shelves.find(s => s.key === 'quick').recipes.map(x => x.id)).toEqual(['Pasta', 'Tacos'])
    expect(shelves.find(s => s.key === 'slow').recipes.map(x => x.id)).toEqual(['Chili'])
    expect(shelves.find(s => s.key === 'new').recipes.map(x => x.id)).toEqual(['Pasta'])
  })

  it('a slow cooker recipe is found by its name too', () => {
    const shelves = buildShelves([r('Southwestern Crockpot Chicken Tacos'), r('Slow-Cooker Ribs')], { today })
    expect(shelves.find(s => s.key === 'slow').recipes).toHaveLength(2)
  })

  it("haven't made lately lists recipes last planned over three weeks ago, oldest first", () => {
    const picks = [
      { recipe_id: 'a', planned_for: '2026-09-01' },
      { recipe_id: 'a', planned_for: '2026-09-20' },
      { recipe_id: 'b', planned_for: '2026-08-01' },
      { recipe_id: 'c', planned_for: '2026-10-30' },
      { recipe_id: 'd', planned_for: '2026-11-20' },
      { recipe_id: null, planned_for: '2026-08-01' },
    ]
    const lastMade = lastMadeByRecipe(picks, today)
    expect(lastMade.get('a')).toBe('2026-09-20')
    expect(lastMade.has('d')).toBe(false)
    const shelves = buildShelves([r('a'), r('b'), r('c'), r('d')], { lastMade, today })
    expect(shelves.find(s => s.key === 'lately').recipes.map(x => x.id)).toEqual(['b', 'a'])
  })
})
