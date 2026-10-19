import { describe, it, expect, beforeEach } from 'vitest'
import { createFakeSupabase, chainHas } from '../test/fakeSupabase'
import {
  insertGroceryItem, updateGroceryItem, deleteGroceryItem, setGrocerySortOrder,
  mergeInventoryItem, updateInventoryItem, deleteInventoryItem,
  insertMealPick, deleteMealPick, deleteMealPicks,
} from './writes'

let client
beforeEach(() => { client = createFakeSupabase() })

describe('grocery writes', () => {
  it('insertGroceryItem sends the client-generated id and returns the server row', async () => {
    client.setResult('grocery_items', 'insert', { data: { id: 'g1', name: 'Milk' }, error: null })
    const row = await insertGroceryItem(client, { id: 'g1', name: 'Milk' })
    expect(row).toEqual({ id: 'g1', name: 'Milk' })
    const call = client.callsFor('grocery_items', 'insert')[0]
    expect(chainHas(call, 'insert', { id: 'g1', name: 'Milk' })).toBe(true)
    expect(chainHas(call, 'select')).toBe(true)
    expect(chainHas(call, 'single')).toBe(true)
  })

  it('updateGroceryItem and deleteGroceryItem throw on error', async () => {
    client.setResult('grocery_items', 'update', { data: null, error: { message: 'nope' } })
    await expect(updateGroceryItem(client, 'g1', { qty: 2 })).rejects.toThrow('nope')
    client.setResult('grocery_items', 'delete', { data: null, error: { message: 'gone wrong' } })
    await expect(deleteGroceryItem(client, 'g1')).rejects.toThrow('gone wrong')
  })

  it('setGrocerySortOrder uses the RPC and falls back to per-row updates when it is missing', async () => {
    client.setResult('rpc', 'set_grocery_sort_order', { data: null, error: null })
    await setGrocerySortOrder(client, ['a', 'b'], 'u1')
    expect(client.rpc).toHaveBeenCalledWith('set_grocery_sort_order', { p_ids: ['a', 'b'] })
    expect(client.callsFor('grocery_items', 'update')).toHaveLength(0)

    client.reset()
    client.setResult('rpc', 'set_grocery_sort_order', { data: null, error: { code: 'PGRST202' } })
    client.setResult('grocery_items', 'update', { data: null, error: null })
    await setGrocerySortOrder(client, ['a', 'b'], 'u1')
    const updates = client.callsFor('grocery_items', 'update')
    expect(updates).toHaveLength(2)
    expect(chainHas(updates[0], 'update', { sort_order: 0, updated_by: 'u1' })).toBe(false) // includes updated_at too
    expect(updates[0].chain.find(([m]) => m === 'update')[1]).toMatchObject({ sort_order: 0, updated_by: 'u1' })
    expect(chainHas(updates[1], 'eq', 'id', 'b')).toBe(true)
  })
})

describe('inventory writes', () => {
  const data = { household_id: 'hh', name: 'Rice', qty: 2, unit: 'bags', location: 'pantry', category: 'Dry Goods', updated_by: 'u1' }

  it('mergeInventoryItem returns { merged, item } from the RPC', async () => {
    client.setResult('rpc', 'merge_inventory_item', { data: { merged: true, item: { id: 'a', qty: 5 } }, error: null })
    const res = await mergeInventoryItem(client, data)
    expect(res).toEqual({ merged: true, item: { id: 'a', qty: 5 } })
    expect(client.rpc).toHaveBeenCalledWith('merge_inventory_item', expect.objectContaining({ p_household_id: 'hh', p_name: 'Rice', p_location: 'pantry' }))
  })

  it('mergeInventoryItem falls back to a plain insert (with a client id if given) when the RPC is missing', async () => {
    client.setResult('rpc', 'merge_inventory_item', { data: null, error: { code: 'PGRST202' } })
    client.setResult('inventory_items', 'insert', { data: { id: 'c', ...data }, error: null })
    const res = await mergeInventoryItem(client, { id: 'c', ...data })
    expect(res.merged).toBe(false)
    expect(res.item.id).toBe('c')
    expect(chainHas(client.callsFor('inventory_items', 'insert')[0], 'single')).toBe(true)
  })

  it('deleteInventoryItem reports alreadyGone on a 0-row delete and throws on error', async () => {
    client.setResult('inventory_items', 'delete', { data: [], error: null })
    expect(await deleteInventoryItem(client, 'a')).toEqual({ alreadyGone: true })
    client.setResult('inventory_items', 'delete', { data: [{ id: 'a' }], error: null })
    expect(await deleteInventoryItem(client, 'a')).toEqual({ alreadyGone: false })
    client.setResult('inventory_items', 'delete', { data: null, error: { message: 'denied' } })
    await expect(deleteInventoryItem(client, 'a')).rejects.toThrow('denied')
  })

  it('updateInventoryItem selects back the id and throws on error', async () => {
    client.setResult('inventory_items', 'update', { data: [{ id: 'a' }], error: null })
    await updateInventoryItem(client, 'a', { qty: 3 })
    const call = client.callsFor('inventory_items', 'update')[0]
    expect(chainHas(call, 'eq', 'id', 'a')).toBe(true)
    expect(chainHas(call, 'select', 'id')).toBe(true)
  })
})

describe('meal pick writes', () => {
  it('insertMealPick returns the row; deleteMealPick and deleteMealPicks throw on error', async () => {
    client.setResult('meal_picks', 'insert', { data: { id: 'p1' }, error: null })
    expect(await insertMealPick(client, { id: 'p1', name: 'Tacos' })).toEqual({ id: 'p1' })
    client.setResult('meal_picks', 'delete', { data: null, error: { message: 'x' } })
    await expect(deleteMealPick(client, 'p1')).rejects.toThrow('x')
    await expect(deleteMealPicks(client, 'hh', ['p1'])).rejects.toThrow('x')
  })
})
