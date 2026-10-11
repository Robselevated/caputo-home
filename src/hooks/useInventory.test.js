import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../lib/db', () => ({ queueWrite: vi.fn(async () => {}) }))
vi.mock('../components/ui/Toast', () => {
  const toast = vi.fn(() => 1)
  toast.dismiss = vi.fn()
  return { toast }
})

import { supabase } from '../lib/supabase'
import { chainHas } from '../test/fakeSupabase'
import { queueWrite } from '../lib/db'
import { toast } from '../components/ui/Toast'
import { useInventory } from './useInventory'

const rice = { id: 'a', household_id: 'hh', location: 'pantry', name: 'Rice', category: 'Dry Goods', subcategory: null, qty: 1, unit: 'bags' }
const beans = { id: 'b', household_id: 'hh', location: 'pantry', name: 'Beans', category: 'Canned', subcategory: null, qty: 2, unit: 'cans' }

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

async function renderLoaded() {
  const hook = renderHook(() => useInventory('hh', 'pantry'))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  await waitFor(() => expect(hook.result.current.items).toHaveLength(2))
  return hook
}

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  setOnline(true)
  supabase.setResult('inventory_items', 'select', { data: [beans, rice], error: null })
})

describe('useInventory load', () => {
  it('fetches the location without the unused users join', async () => {
    await renderLoaded()
    const sel = supabase.callsFor('inventory_items', 'select')[0]
    const selectArg = sel.chain.find(([m]) => m === 'select')[1]
    expect(selectArg).not.toContain('users')
    expect(chainHas(sel, 'eq', 'location', 'pantry')).toBe(true)
  })
})

describe('useInventory.deleteItem', () => {
  it('deletes with .select("id") so a silent 0-row delete is detectable, and removes the row', async () => {
    supabase.setResult('inventory_items', 'delete', { data: [{ id: 'a' }], error: null })
    const { result } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.deleteItem('a') })
    expect(res).toEqual({ error: null })
    expect(result.current.items.map(i => i.id)).toEqual(['b'])
    const del = supabase.callsFor('inventory_items', 'delete')[0]
    expect(chainHas(del, 'eq', 'id', 'a')).toBe(true)
    expect(chainHas(del, 'select', 'id')).toBe(true)
  })

  it('restores the row and shows an error toast when the delete fails', async () => {
    supabase.setResult('inventory_items', 'delete', { data: null, error: { message: 'network down' } })
    const { result } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.deleteItem('a') })
    expect(res.error).toBeTruthy()
    expect(result.current.items.map(i => i.id).sort()).toEqual(['a', 'b'])
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }))
    // no silent refetch: the list came from one select only
    expect(supabase.callsFor('inventory_items', 'select')).toHaveLength(1)
  })

  it('treats 0 affected rows as already gone (keeps it removed, no error)', async () => {
    supabase.setResult('inventory_items', 'delete', { data: [], error: null })
    const { result } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.deleteItem('a') })
    expect(res).toEqual({ error: null, alreadyGone: true })
    expect(result.current.items.map(i => i.id)).toEqual(['b'])
  })

  it('queues the delete when offline instead of dropping it', async () => {
    const { result } = await renderLoaded()
    setOnline(false)
    let res
    await act(async () => { res = await result.current.deleteItem('a') })
    expect(res).toEqual({ error: null, queued: true })
    expect(result.current.items.map(i => i.id)).toEqual(['b'])
    expect(queueWrite).toHaveBeenCalledWith({ type: 'inventory_delete', itemId: 'a' })
    expect(supabase.callsFor('inventory_items', 'delete')).toHaveLength(0)
  })
})

describe('useInventory.addItem', () => {
  const apples = { id: 'c', household_id: 'hh', location: 'pantry', name: 'Apples', category: 'Canned', subcategory: null, qty: 2, unit: 'count' }

  it('merges through the RPC and shows the returned row once, even after the realtime echo', async () => {
    supabase.setResult('rpc', 'merge_inventory_item', { data: { merged: false, item: apples }, error: null })
    const { result } = await renderLoaded()
    let res
    await act(async () => {
      res = await result.current.addItem({ name: ' Apples ', qty: 2, unit: 'count', category: 'Canned', userId: 'u1' })
    })
    expect(res.error).toBeNull()
    expect(res.merged).toBe(false)
    expect(supabase.rpc).toHaveBeenCalledWith('merge_inventory_item', expect.objectContaining({
      p_household_id: 'hh', p_name: 'Apples', p_qty: 2, p_location: 'pantry', p_category: 'Canned',
    }))
    expect(result.current.items.filter(i => i.id === 'c')).toHaveLength(1)
    act(() => supabase.emit({ eventType: 'INSERT', new: apples, old: {} }))
    expect(result.current.items.filter(i => i.id === 'c')).toHaveLength(1)
    expect(supabase.callsFor('inventory_items', 'select')).toHaveLength(1)
  })

  it('reports merged:true with the updated row when the name already exists', async () => {
    supabase.setResult('rpc', 'merge_inventory_item', { data: { merged: true, item: { ...rice, qty: 4 } }, error: null })
    const { result } = await renderLoaded()
    let res
    await act(async () => {
      res = await result.current.addItem({ name: 'rice', qty: 3, category: 'Dry Goods', userId: 'u1' })
    })
    expect(res.merged).toBe(true)
    expect(result.current.items.find(i => i.id === 'a').qty).toBe(4)
    expect(result.current.items.filter(i => i.name.toLowerCase() === 'rice')).toHaveLength(1)
  })

  it('falls back to a plain insert when the RPC is not deployed yet (PGRST202)', async () => {
    supabase.setResult('rpc', 'merge_inventory_item', { data: null, error: { code: 'PGRST202', message: 'missing' } })
    supabase.setResult('inventory_items', 'insert', { data: { ...apples, id: 'd' }, error: null })
    const { result } = await renderLoaded()
    let res
    await act(async () => {
      res = await result.current.addItem({ name: 'Apples', qty: 2, category: 'Canned', userId: 'u1' })
    })
    expect(res.error).toBeNull()
    const ins = supabase.callsFor('inventory_items', 'insert')[0]
    expect(chainHas(ins, 'select')).toBe(true)
    expect(chainHas(ins, 'single')).toBe(true)
    expect(result.current.items.some(i => i.id === 'd')).toBe(true)
  })

  it('queues a merge when offline and shows the item optimistically', async () => {
    const { result } = await renderLoaded()
    setOnline(false)
    let res
    await act(async () => {
      res = await result.current.addItem({ name: 'Apples', qty: 2, category: 'Canned', userId: 'u1' })
    })
    expect(res).toMatchObject({ error: null, queued: true })
    expect(result.current.items.some(i => i.name === 'Apples')).toBe(true)
    expect(queueWrite).toHaveBeenCalledWith(expect.objectContaining({
      type: 'inventory_merge',
      data: expect.objectContaining({ household_id: 'hh', name: 'Apples', location: 'pantry', category: 'Canned' }),
    }))
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('useInventory realtime', () => {
  it('removes a row on a DELETE payload that carries only old.id (no refetch)', async () => {
    const { result } = await renderLoaded()
    act(() => supabase.emit({ eventType: 'DELETE', old: { id: 'a' }, new: {} }))
    expect(result.current.items.map(i => i.id)).toEqual(['b'])
    expect(supabase.callsFor('inventory_items', 'select')).toHaveLength(1)
  })

  it('appends an INSERT for this location without refetching', async () => {
    const { result } = await renderLoaded()
    act(() => supabase.emit({ eventType: 'INSERT', old: {}, new: { id: 'z', location: 'pantry', name: 'Ziti', category: 'Pasta', subcategory: null, qty: 1 } }))
    expect(result.current.items.map(i => i.id)).toContain('z')
    expect(supabase.callsFor('inventory_items', 'select')).toHaveLength(1)
  })

  it('ignores an INSERT for another location', async () => {
    const { result } = await renderLoaded()
    act(() => supabase.emit({ eventType: 'INSERT', old: {}, new: { id: 'z', location: 'fridge', name: 'Milk', category: 'Dairy' } }))
    expect(result.current.items.map(i => i.id)).toEqual(['b', 'a'])
  })
})

describe('useInventory.updateQty', () => {
  it('applies optimistically and reverts with a toast when the update fails', async () => {
    supabase.setResult('inventory_items', 'update', { data: null, error: { message: 'nope' } })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.updateQty('a', 5, 'u1') })
    expect(result.current.items.find(i => i.id === 'a').qty).toBe(1)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }))
  })

  it('keeps the new qty when the update succeeds', async () => {
    supabase.setResult('inventory_items', 'update', { data: [{ id: 'a' }], error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.updateQty('a', 5, 'u1') })
    expect(result.current.items.find(i => i.id === 'a').qty).toBe(5)
    expect(toast).not.toHaveBeenCalled()
  })

  it('queues the change when offline', async () => {
    const { result } = await renderLoaded()
    setOnline(false)
    await act(async () => { await result.current.updateQty('a', 5, 'u1') })
    expect(result.current.items.find(i => i.id === 'a').qty).toBe(5)
    expect(queueWrite).toHaveBeenCalledWith(expect.objectContaining({ type: 'inventory_update', itemId: 'a', changes: expect.objectContaining({ qty: 5 }) }))
  })
})

describe('useInventory.addToGroceryList', () => {
  it('inserts the grocery row and confirms with a toast', async () => {
    supabase.setResult('grocery_items', 'insert', { data: null, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.addToGroceryList(rice, 'u1') })
    const ins = supabase.callsFor('grocery_items', 'insert')[0]
    expect(ins).toBeTruthy()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Rice') }))
  })

  it('shows an error toast when the grocery insert fails', async () => {
    supabase.setResult('grocery_items', 'insert', { data: null, error: { message: 'x' } })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.addToGroceryList(rice, 'u1') })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }))
  })
})
