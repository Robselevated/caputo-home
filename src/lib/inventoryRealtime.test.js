import { describe, it, expect } from 'vitest'
import { applyInventoryChange, sortInventory } from './inventoryRealtime'

const rice = { id: 'a', location: 'pantry', name: 'Rice', category: 'Dry Goods', subcategory: null, qty: 1 }
const beans = { id: 'b', location: 'pantry', name: 'Beans', category: 'Canned', subcategory: null, qty: 2 }
const items = [beans, rice]

describe('applyInventoryChange', () => {
  it('DELETE removes by old.id even when old has no other fields (default REPLICA IDENTITY)', () => {
    const next = applyInventoryChange(items, { eventType: 'DELETE', old: { id: 'a' }, new: {} }, 'pantry')
    expect(next.map(i => i.id)).toEqual(['b'])
  })

  it('DELETE of an unknown id leaves the list unchanged', () => {
    const next = applyInventoryChange(items, { eventType: 'DELETE', old: { id: 'zzz' }, new: {} }, 'pantry')
    expect(next).toEqual(items)
  })

  it('UPDATE in our location merges the new fields into the existing row', () => {
    const next = applyInventoryChange(items, { eventType: 'UPDATE', old: { id: 'a' }, new: { id: 'a', location: 'pantry', qty: 5 } }, 'pantry')
    expect(next.find(i => i.id === 'a')).toMatchObject({ name: 'Rice', qty: 5 })
  })

  it('UPDATE that moves the row to another location removes it from this view', () => {
    const next = applyInventoryChange(items, { eventType: 'UPDATE', old: { id: 'a' }, new: { id: 'a', location: 'fridge', qty: 1 } }, 'pantry')
    expect(next.map(i => i.id)).toEqual(['b'])
  })

  it('UPDATE that moves a row into our location appends it', () => {
    const moved = { id: 'c', location: 'pantry', name: 'Apples', category: 'Produce', subcategory: null, qty: 3 }
    const next = applyInventoryChange(items, { eventType: 'UPDATE', old: { id: 'c' }, new: moved }, 'pantry')
    expect(next.map(i => i.id)).toContain('c')
  })

  it('INSERT for our location appends without duplicating an id that is already present', () => {
    const next = applyInventoryChange(items, { eventType: 'INSERT', old: {}, new: { ...rice, qty: 9 } }, 'pantry')
    expect(next.filter(i => i.id === 'a')).toHaveLength(1)
    expect(next.find(i => i.id === 'a').qty).toBe(9)
  })

  it('INSERT for another location is ignored', () => {
    const next = applyInventoryChange(items, { eventType: 'INSERT', old: {}, new: { id: 'x', location: 'fridge', name: 'Milk', category: 'Dairy' } }, 'pantry')
    expect(next).toEqual(items)
  })

  it('keeps the server ordering: category, subcategory, name', () => {
    const next = applyInventoryChange(items, { eventType: 'INSERT', old: {}, new: { id: 'c', location: 'pantry', name: 'Apples', category: 'Canned', subcategory: null } }, 'pantry')
    expect(next.map(i => i.name)).toEqual(['Apples', 'Beans', 'Rice'])
  })
})

describe('sortInventory', () => {
  it('sorts by category, then subcategory (nulls last), then name, case-insensitively', () => {
    const rows = [
      { id: 1, category: 'Pasta', subcategory: null, name: 'ziti' },
      { id: 2, category: 'Pasta', subcategory: 'Long', name: 'Spaghetti' },
      { id: 3, category: 'Canned', subcategory: null, name: 'Tomatoes' },
      { id: 4, category: 'Pasta', subcategory: 'Long', name: 'angel hair' },
    ]
    expect(sortInventory(rows).map(r => r.id)).toEqual([3, 4, 2, 1])
  })
})
