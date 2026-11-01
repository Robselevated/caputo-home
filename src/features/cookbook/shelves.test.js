import { describe, it, expect } from 'vitest'
import { COLLECTIONS, pickCollection } from './shelves'

const today = new Date(2026, 10, 2)
const r = (id, o = {}) => ({ id, name: id, tags: [], prep_time: null, cook_time: null, created_at: '2026-01-01T00:00:00Z', ...o })

describe('Cookbook collections', () => {
  it('lists the tabs in bar order', () => {
    expect(COLLECTIONS.map(c => c.label)).toEqual(['Ready to cook', 'Quick 30 min', 'Slow cooker', 'New this month', 'Breakfast', 'Dinners', 'Sides & Apps', 'Desserts'])
  })

  it('fills each collection by its rule', () => {
    const recipes = [
      r('Tacos', { prep_time: 10, cook_time: 15 }),
      r('Chili', { tags: ['Crockpot'], cook_time: 480 }),
      r('Pasta', { cook_time: 20, created_at: '2026-10-25T00:00:00Z' }),
      r('Pancakes', { tags: ['breakfast'] }),
      r('Soup'),
    ]
    const ids = (key, ctx) => pickCollection(key, recipes, { today, ...ctx }).map(x => x.id)
    expect(ids('ready', { readyIds: new Set(['Soup']) })).toEqual(['Soup'])
    expect(ids('quick')).toEqual(['Pasta', 'Tacos'])
    expect(ids('slow')).toEqual(['Chili'])
    expect(ids('new')).toEqual(['Pasta'])
    expect(ids('breakfast')).toEqual(['Pancakes'])
    expect(ids('dinner')).toEqual(['Chili', 'Pasta', 'Soup', 'Tacos'])
  })

  it('a slow cooker recipe is found by its name too', () => {
    expect(pickCollection('slow', [r('Southwestern Crockpot Chicken Tacos'), r('Slow-Cooker Ribs')], { today })).toHaveLength(2)
  })

  it('an unknown key picks nothing', () => {
    expect(pickCollection('nope', [r('Tacos')], { today })).toEqual([])
  })
})
