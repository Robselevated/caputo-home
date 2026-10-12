import { describe, it, expect } from 'vitest'
import { shelfLifeDays, freshnessOf, findSuspects, DAY_MS } from './shelfLife'

const NOW = Date.parse('2026-10-12T12:00:00Z')
const daysAgo = (n) => new Date(NOW - n * DAY_MS).toISOString()
const row = (o) => ({ id: o.name, qty: 1, location: 'fridge', category: 'Other', subcategory: null, created_at: daysAgo(30), stocked_at: null, checked_at: null, ...o })

describe('shelfLifeDays', () => {
  it.each([
    [{ name: 'Milk', location: 'fridge', category: 'Dairy' }, 7],
    [{ name: 'Oat milk', location: 'fridge', category: 'Beverages' }, 10],
    [{ name: 'Cream cheese', location: 'fridge', category: 'Dairy' }, 14],
    [{ name: 'Cottage Cheese', location: 'fridge', category: 'Dairy' }, 10],
    [{ name: 'Eggs', location: 'fridge', category: 'Dairy' }, 28],
    [{ name: 'Strawberries', location: 'fridge', category: 'Fresh Produce' }, 4],
    [{ name: 'Baby spinach', location: 'fridge', category: 'Fresh Produce' }, 6],
    [{ name: 'Black Forest ham', location: 'fridge', category: 'Deli Meat' }, 5],
    [{ name: 'Graham crackers', location: 'pantry', category: 'Snacks' }, null],
    [{ name: 'Sourdough', location: 'pantry', category: 'Bread' }, 6],
    [{ name: 'Carrots', location: 'fridge', category: 'Fresh Produce' }, 21],
    [{ name: 'Mystery veg', location: 'fridge', category: 'Fresh Produce' }, 7],
    [{ name: 'Shredded cheddar', location: 'fridge', category: 'Dairy' }, 14],
    [{ name: 'Cheddar', location: 'fridge', category: 'Dairy' }, 10],
    [{ name: 'Ketchup', location: 'fridge', category: 'Condiments' }, null],
    [{ name: 'Chicken thighs', location: 'freezer', category: 'Chicken' }, 180],
    [{ name: 'Ground beef', location: 'freezer', category: 'Ground Meat' }, 120],
    [{ name: 'Salmon', location: 'freezer', category: 'Fish' }, 90],
    [{ name: 'Peas', location: 'freezer', category: 'Frozen Produce' }, 240],
    [{ name: 'Spaghetti', location: 'pantry', category: 'Pasta' }, null],
    [{ name: 'Paper towels', location: 'home_goods', category: 'Paper Products' }, null],
    [{ name: 'Chicken breast', location: 'fridge', category: 'Other' }, 2],
    [{ name: 'Coconut milk', location: 'pantry', category: 'Canned Goods' }, null],
    [{ name: 'Dried basil', location: 'pantry', category: 'Spices' }, null],
    [{ name: 'Flour tortillas', location: 'pantry', category: 'Bread' }, 14],
  ])('%o -> %s', (item, days) => {
    expect(shelfLifeDays(item)).toBe(days)
  })
})

describe('freshnessOf', () => {
  it('counts from stocked_at and falls back to created_at', () => {
    expect(freshnessOf(row({ name: 'Milk', category: 'Dairy', stocked_at: daysAgo(9) }), NOW)).toMatchObject({ limitDays: 7, ageDays: 9, overdueDays: 2 })
    expect(freshnessOf(row({ name: 'Milk', category: 'Dairy', created_at: daysAgo(3) }), NOW)).toMatchObject({ limitDays: 7, ageDays: 3, overdueDays: -4 })
  })
  it('a later checked_at wins over stocked_at', () => {
    const r = freshnessOf(row({ name: 'Milk', category: 'Dairy', stocked_at: daysAgo(20), checked_at: daysAgo(2) }), NOW)
    expect(r.ageDays).toBe(2)
  })
})

describe('findSuspects', () => {
  it('lists overdue, stocked items most overdue first and skips the rest', () => {
    const items = [
      row({ name: 'Milk', category: 'Dairy', stocked_at: daysAgo(9) }),
      row({ name: 'Eggs', category: 'Dairy', stocked_at: daysAgo(40) }),
      row({ name: 'Ketchup', category: 'Condiments', stocked_at: daysAgo(400) }),
      row({ name: 'Yogurt', category: 'Dairy', stocked_at: daysAgo(30), qty: 0 }),
      row({ name: 'Butter', category: 'Dairy', stocked_at: daysAgo(10) }),
      row({ name: 'Chicken thighs', location: 'freezer', category: 'Chicken', stocked_at: daysAgo(200) }),
      row({ name: 'Cheddar', category: 'Dairy', stocked_at: daysAgo(30), checked_at: daysAgo(1) }),
    ]
    const out = findSuspects(items, NOW)
    expect(out.map(s => s.item.name)).toEqual(['Chicken thighs', 'Eggs', 'Milk'])
    expect(out[2]).toMatchObject({ limitDays: 7, ageDays: 9 })
  })
  it('returns nothing for an empty or fresh list', () => {
    expect(findSuspects([], NOW)).toEqual([])
    expect(findSuspects([row({ name: 'Milk', category: 'Dairy', stocked_at: daysAgo(1) })], NOW)).toEqual([])
  })
})
