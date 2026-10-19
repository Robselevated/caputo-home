import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})

import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { keys } from '../queries/keys'
import { useRecipeMatch } from './useRecipeMatch'

beforeEach(() => { supabase.reset(); vi.clearAllMocks() })

describe('useRecipeMatch keeps the shared cache honest', () => {
  it('addMissingToGroceryList and addDepletedToGroceryList refresh the grocery cache', async () => {
    supabase.setResult('grocery_items', 'insert', { data: null, error: null })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRecipeMatch('hh'))
    await act(async () => { await result.current.addMissingToGroceryList([{ name: 'limes', qty: 2, unit: null }], 'Tacos', 'u1', 'hh') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.grocery('hh') })
    spy.mockClear()
    await act(async () => { await result.current.addDepletedToGroceryList([{ name: 'rice', inventoryItem: { qty: 0, unit: 'bags' } }], 'Tacos', 'u1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.grocery('hh') })
    spy.mockRestore()
  })

  it('"I made this" decrements refresh the kitchen cache', async () => {
    supabase.setResult('inventory_items', 'update', { data: null, error: null })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRecipeMatch('hh'))
    const match = { inInventory: [{ name: 'rice', qty: 1, unit: 'bags', inventoryItem: { id: 'a', qty: 2, unit: 'bags' } }] }
    await act(async () => { await result.current.useRecipe(match, 'Tacos', 'u1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.inventory('hh') })
    spy.mockRestore()
  })
})

// "I made this": unit-aware consume. The recipe side carries qty/unit as the
// parser stored them; the inventory side carries the kitchen row.
describe('useRecipe consumes with unit awareness', () => {
  const consume = async (inInventory) => {
    supabase.setResult('inventory_items', 'update', { data: null, error: null })
    const { result } = renderHook(() => useRecipeMatch('hh'))
    let r
    await act(async () => { r = await result.current.useRecipe({ inInventory }, 'Tacos', 'u1') })
    return r
  }
  const updatePayloads = () => supabase.callsFor('inventory_items', 'update').map(c => c.chain.find(([m]) => m === 'update')[1])

  it('skips an ingredient with no amount and says why', async () => {
    const r = await consume([
      { id: 'i1', name: 'salt', qty: null, qty_text: 'to taste', unit: '', inventoryItem: { id: 'a', qty: 1, unit: 'count' } },
    ])
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0]).toMatchObject({ name: 'salt', reason: 'no amount' })
    expect(r.decremented).toEqual([])
    expect(r.nowOut).toEqual([])
    expect(r.failedCount).toBe(0)
    expect(updatePayloads()).toHaveLength(0)
  })

  it('skips when the unit families differ and names both sides', async () => {
    const r = await consume([
      { id: 'i1', name: 'cream cheese', qty: 8, qty_text: '8', unit: 'oz', inventoryItem: { id: 'a', qty: 1, unit: 'packages' } },
    ])
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0]).toMatchObject({ name: 'cream cheese', reason: 'units differ', detail: '8 oz vs 1 package' })
    expect(r.decremented).toEqual([])
    expect(updatePayloads()).toHaveLength(0)
  })

  it('treats different count units as not interchangeable', async () => {
    const r = await consume([
      { id: 'i1', name: 'black beans', qty: 1, qty_text: '1', unit: 'can', inventoryItem: { id: 'a', qty: 2, unit: 'boxes' } },
    ])
    expect(r.skipped[0]).toMatchObject({ reason: 'units differ', detail: '1 can vs 2 box' })
    expect(updatePayloads()).toHaveLength(0)
  })

  it('converts within a family before subtracting', async () => {
    const r = await consume([
      { id: 'i1', name: 'ground beef', qty: 8, qty_text: '8', unit: 'oz', inventoryItem: { id: 'a', qty: 2, unit: 'lbs' } },
      { id: 'i2', name: 'olive oil', qty: 3, qty_text: '3', unit: 'tsp', inventoryItem: { id: 'b', qty: 2, unit: 'tbsp' } },
    ])
    expect(r.skipped).toEqual([])
    expect(r.decremented).toHaveLength(2)
    expect(r.decremented[0]).toMatchObject({ name: 'ground beef', oldQty: 2, newQty: 1.5, used: 0.5 })
    expect(r.decremented[1]).toMatchObject({ name: 'olive oil', oldQty: 2, newQty: 1, used: 1 })
    const payloads = updatePayloads()
    expect(payloads.map(p => p.qty)).toEqual([1.5, 1])
    const calls = supabase.callsFor('inventory_items', 'update')
    expect(calls[0].builder.has('eq', 'id', 'a')).toBe(true)
    expect(calls[1].builder.has('eq', 'id', 'b')).toBe(true)
  })

  it('subtracts the raw number when neither side has a unit, and a blank unit counts as count', async () => {
    const r = await consume([
      { id: 'i1', name: 'eggs', qty: 2, qty_text: '2', unit: null, inventoryItem: { id: 'a', qty: 12, unit: null } },
      { id: 'i2', name: 'limes', qty: 3, qty_text: '3', unit: '', inventoryItem: { id: 'b', qty: 3, unit: 'count' } },
    ])
    expect(r.skipped).toEqual([])
    expect(r.decremented[0]).toMatchObject({ name: 'eggs', oldQty: 12, newQty: 10 })
    expect(r.decremented[1]).toMatchObject({ name: 'limes', oldQty: 3, newQty: 0 })
    expect(r.nowOut.map(i => i.name)).toEqual(['limes'])
  })

  it('never goes below zero', async () => {
    const r = await consume([
      { id: 'i1', name: 'flour', qty: 3, qty_text: '3', unit: 'cups', inventoryItem: { id: 'a', qty: 1, unit: 'cup' } },
    ])
    expect(r.decremented[0]).toMatchObject({ oldQty: 1, newQty: 0 })
    expect(r.nowOut).toHaveLength(1)
  })

  it('two lines matching one pantry row subtract cumulatively and write the row once', async () => {
    const flour = { id: 'a', qty: 5, unit: 'cups' }
    const r = await consume([
      { id: 'i1', name: 'flour', qty: 2, qty_text: '2', unit: 'cups', inventoryItem: flour },
      { id: 'i2', name: 'flour', qty: 1, qty_text: '1', unit: 'cups', inventoryItem: flour },
    ])
    expect(r.decremented[0]).toMatchObject({ oldQty: 5, newQty: 3 })
    expect(r.decremented[1]).toMatchObject({ oldQty: 3, newQty: 2 })
    expect(updatePayloads().map(p => p.qty)).toEqual([2])
  })

  it('reports lines whose row failed to save instead of listing them as updated', async () => {
    const { result } = renderHook(() => useRecipeMatch('hh'))
    let n = 0
    supabase.setResult('inventory_items', 'update', () => (++n === 1 ? { data: null, error: { message: 'x' } } : { data: null, error: null }))
    let r
    await act(async () => {
      r = await result.current.useRecipe({ inInventory: [
        { id: 'i1', name: 'eggs', qty: 12, qty_text: '12', unit: null, inventoryItem: { id: 'a', qty: 12, unit: null } },
        { id: 'i2', name: 'milk', qty: 1, qty_text: '1', unit: null, inventoryItem: { id: 'b', qty: 2, unit: null } },
      ] }, 'Tacos', 'u1')
    })
    expect(r.failedCount).toBe(1)
    expect(r.failed.map(l => l.name)).toEqual(['eggs'])
    expect(r.decremented.map(l => l.name)).toEqual(['milk'])
    expect(r.nowOut).toEqual([])
  })
})

describe('addMissingToGroceryList cleans the names it inserts', () => {
  it('strips amounts, unit words and parentheticals, and drops empties', async () => {
    supabase.setResult('grocery_items', 'insert', { data: null, error: null })
    const { result } = renderHook(() => useRecipeMatch('hh'))
    const missing = [
      { name: '(15 oz) can diced tomatoes', qty: 1, unit: 'can' },
      { name: '2 cups flour', qty: 2, unit: 'cup' },
      { name: 'Kidney beans', qty: 2, unit: 'cans' },
      { name: '(optional)', qty: null, unit: null },
    ]
    let r
    await act(async () => { r = await result.current.addMissingToGroceryList(missing, 'Chili', 'u1', 'hh') })
    expect(r).toEqual({ success: true, added: 3 })
    const inserted = supabase.callsFor('grocery_items', 'insert')[0].chain.find(([m]) => m === 'insert')[1]
    expect(inserted.map(i => i.name)).toEqual(['diced tomatoes', 'flour', 'Kidney beans'])
    expect(inserted[0]).toMatchObject({ qty: 1, unit: 'can', notes: 'For: Chili', household_id: 'hh', added_by: 'u1', updated_by: 'u1', checked: false })
  })

  it('inserts nothing when every name cleans to empty', async () => {
    supabase.setResult('grocery_items', 'insert', { data: null, error: null })
    const { result } = renderHook(() => useRecipeMatch('hh'))
    let r
    await act(async () => { r = await result.current.addMissingToGroceryList([{ name: '(optional)' }, { name: '2 cups' }], 'Chili', 'u1', 'hh') })
    expect(r).toEqual({ success: true, added: 0 })
    expect(supabase.callsFor('grocery_items', 'insert')).toHaveLength(0)
  })
})
