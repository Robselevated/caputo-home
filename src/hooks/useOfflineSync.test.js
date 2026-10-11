import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
const dbState = { writes: [] }
vi.mock('../lib/db', () => ({
  queueWrite: vi.fn(async () => {}),
  cacheGroceryItems: vi.fn(async () => {}),
  getCachedGroceryItems: vi.fn(async () => []),
  getPendingWrites: vi.fn(async () => dbState.writes),
  clearWrite: vi.fn(async (id) => { dbState.writes = dbState.writes.filter(w => w.id !== id) }),
  getPendingCount: vi.fn(async () => dbState.writes.length),
  incrementWriteAttempts: vi.fn(async (id) => {
    const w = dbState.writes.find(x => x.id === id)
    if (!w) return 0
    w.attempts = (w.attempts || 0) + 1
    return w.attempts
  }),
}))

import { supabase } from '../lib/supabase'
import { chainHas } from '../test/fakeSupabase'
import { clearWrite, incrementWriteAttempts } from '../lib/db'
import { useOfflineSync } from './useOfflineSync'

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  dbState.writes = []
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

async function sync() {
  const hook = renderHook(() => useOfflineSync('hh'))
  await act(async () => { await hook.result.current.syncNow() })
  return hook
}

describe('useOfflineSync.syncNow replay', () => {
  it('replays a check through the check-off RPC', async () => {
    dbState.writes = [{ id: 1, type: 'check', item: { id: 'g1', name: 'Milk', qty: 1, unit: 'gallon' }, householdId: 'hh', userId: 'u1', location: 'fridge', category: 'Dairy', unit: 'gallon' }]
    supabase.setResult('rpc', 'check_off_grocery_item', { data: { status: 'ok' }, error: null })
    await sync()
    expect(supabase.rpc).toHaveBeenCalledWith('check_off_grocery_item', expect.objectContaining({ p_item_id: 'g1', p_location: 'fridge' }))
    expect(clearWrite).toHaveBeenCalledWith(1)
  })

  it('replays inventory_merge (and legacy inventory_add) through merge_inventory_item', async () => {
    const data = { household_id: 'hh', name: 'Rice', qty: 2, unit: 'bags', location: 'pantry', category: 'Dry Goods', updated_by: 'u1' }
    dbState.writes = [
      { id: 1, type: 'inventory_merge', data },
      { id: 2, type: 'inventory_add', data: { ...data, name: 'Beans' } },
    ]
    supabase.setResult('rpc', 'merge_inventory_item', { data: { merged: false, item: {} }, error: null })
    await sync()
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc).toHaveBeenCalledWith('merge_inventory_item', expect.objectContaining({ p_household_id: 'hh', p_name: 'Rice', p_location: 'pantry' }))
    expect(supabase.rpc).toHaveBeenCalledWith('merge_inventory_item', expect.objectContaining({ p_name: 'Beans' }))
    expect(clearWrite).toHaveBeenCalledTimes(2)
  })

  it('replays inventory_delete and inventory_update', async () => {
    dbState.writes = [
      { id: 1, type: 'inventory_delete', itemId: 'a' },
      { id: 2, type: 'inventory_update', itemId: 'b', changes: { qty: 5 } },
    ]
    supabase.setResult('inventory_items', 'delete', { data: [{ id: 'a' }], error: null })
    supabase.setResult('inventory_items', 'update', { data: [{ id: 'b' }], error: null })
    await sync()
    const del = supabase.callsFor('inventory_items', 'delete')[0]
    expect(chainHas(del, 'eq', 'id', 'a')).toBe(true)
    const upd = supabase.callsFor('inventory_items', 'update')[0]
    expect(chainHas(upd, 'update', { qty: 5 })).toBe(true)
    expect(chainHas(upd, 'eq', 'id', 'b')).toBe(true)
    expect(clearWrite).toHaveBeenCalledTimes(2)
  })

  it('keeps a write whose replay returned an error (supabase does not throw) and counts the attempt', async () => {
    dbState.writes = [{ id: 1, type: 'delete', itemId: 'g1' }]
    supabase.setResult('grocery_items', 'delete', { data: null, error: { message: 'network' } })
    await sync()
    expect(clearWrite).not.toHaveBeenCalled()
    expect(incrementWriteAttempts).toHaveBeenCalledWith(1)
  })
})
