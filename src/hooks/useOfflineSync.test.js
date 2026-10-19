import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
const dbState = { writes: [], listeners: [] }
vi.mock('../lib/db', () => ({
  onQueueChange: vi.fn((listener) => { dbState.listeners.push(listener); return () => { dbState.listeners = dbState.listeners.filter(l => l !== listener) } }),
  queueWrite: vi.fn(async () => true),
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

vi.mock('../lib/offlineToasts', () => ({ toastNotQueued: vi.fn(), toastWriteDropped: vi.fn() }))

import { supabase } from '../lib/supabase'
import { toastWriteDropped } from '../lib/offlineToasts'
import { chainHas } from '../test/fakeSupabase'
import { clearWrite, incrementWriteAttempts } from '../lib/db'
import { useOfflineSync } from './useOfflineSync'
import { queryClient } from '../lib/queryClient'
import { keys } from '../queries/keys'

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  dbState.writes = []
  dbState.listeners = []
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

describe('useOfflineSync queue awareness', () => {
  it('tracks the pending count through queue-change events instead of polling', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useOfflineSync('hh'))
      await act(async () => {})
      expect(dbState.listeners).toHaveLength(1)
      act(() => dbState.listeners[0](3))
      expect(result.current.pendingCount).toBe(3)
      const before = (await import('../lib/db')).getPendingCount.mock.calls.length
      await act(async () => { vi.advanceTimersByTime(20000) })
      expect((await import('../lib/db')).getPendingCount.mock.calls.length).toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('refreshes the grocery, kitchen and recently-bought caches after a replay', async () => {
    dbState.writes = [{ id: 1, type: 'delete', itemId: 'g1' }]
    supabase.setResult('grocery_items', 'delete', { data: null, error: null })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    await sync()
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.grocery('hh') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.inventory('hh') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.recentlyBought('hh') })
    spy.mockRestore()
  })
})

describe('useOfflineSync vs reconnect refetch', () => {
  it('cancels in-flight list refetches BEFORE replaying so a pre-replay response cannot overwrite offline edits', async () => {
    dbState.writes = [{ id: 1, type: 'delete', itemId: 'g1' }]
    const order = []
    supabase.setResult('grocery_items', 'delete', () => { order.push('replay'); return { data: null, error: null } })
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries').mockImplementation(async (f) => { order.push('cancel:' + f.queryKey[0]) })
    await sync()
    expect(order.slice(0, 3).sort()).toEqual(['cancel:grocery_items', 'cancel:inventory', 'cancel:recently_bought'])
    expect(order[3]).toBe('replay')
    cancelSpy.mockRestore()
  })
})

describe('useOfflineSync retry and drop', () => {
  it('retries a failed pass on a backoff without waiting for another online event', async () => {
    vi.useFakeTimers()
    try {
      dbState.writes = [{ id: 1, type: 'delete', itemId: 'g1' }]
      let calls = 0
      supabase.setResult('grocery_items', 'delete', () => {
        calls += 1
        return calls === 1 ? { data: null, error: { message: '503' } } : { data: null, error: null }
      })
      // Mount auto-syncs because a write is pending; that pass fails.
      renderHook(() => useOfflineSync('hh'))
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(calls).toBe(1)
      expect(dbState.writes).toHaveLength(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
      expect(calls).toBeGreaterThanOrEqual(2)
      expect(dbState.writes).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('tells the user when a write is dropped after the last attempt', async () => {
    const write = { id: 1, type: 'insert', data: { id: 'g9', name: 'Eggs' }, attempts: 4 }
    dbState.writes = [write]
    supabase.setResult('grocery_items', 'insert', { data: null, error: { message: '500' } })
    const hook = await sync()
    expect(clearWrite).toHaveBeenCalledWith(1)
    expect(toastWriteDropped).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    hook.unmount()
  })
})
