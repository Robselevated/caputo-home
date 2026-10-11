import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../lib/db', () => ({
  queueWrite: vi.fn(async () => {}),
  cacheGroceryItems: vi.fn(async () => {}),
  getCachedGroceryItems: vi.fn(async () => []),
}))

import { supabase } from '../lib/supabase'
import { queueWrite } from '../lib/db'
import { useGroceryList } from './useGroceryList'

const milk = { id: 'g1', household_id: 'hh', name: 'Milk', qty: 1, unit: 'gallon', store: 'Costco', notes: null, checked: false, sort_order: 0 }

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

async function renderLoaded() {
  const hook = renderHook(() => useGroceryList('hh'))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  setOnline(true)
  supabase.setResult('grocery_items', 'select', { data: [milk], error: null })
})

describe('useGroceryList.checkItem', () => {
  it('online: one RPC call, no direct table writes', async () => {
    supabase.setResult('rpc', 'check_off_grocery_item', { data: { status: 'ok' }, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.checkItem(milk, 'u1') })
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('check_off_grocery_item', expect.objectContaining({
      p_item_id: 'g1', p_location: 'fridge', p_category: 'Dairy',
    }))
    expect(supabase.callsFor('recently_bought')).toHaveLength(0)
    expect(supabase.callsFor('inventory_items')).toHaveLength(0)
    expect(supabase.callsFor('grocery_items', 'delete')).toHaveLength(0)
  })

  it('offline: queues ONE check entry that carries the kitchen destination (no separate inventory_add)', async () => {
    const { result } = await renderLoaded()
    setOnline(false)
    await act(async () => { await result.current.checkItem(milk, 'u1') })
    expect(result.current.items).toHaveLength(0)
    expect(queueWrite).toHaveBeenCalledTimes(1)
    expect(queueWrite).toHaveBeenCalledWith(expect.objectContaining({
      type: 'check',
      item: expect.objectContaining({ id: 'g1' }),
      householdId: 'hh',
      userId: 'u1',
      location: 'fridge',
      category: 'Dairy',
      unit: 'gallon',
    }))
  })

  it('fetches the list without the unused users joins', async () => {
    await renderLoaded()
    const sel = supabase.callsFor('grocery_items', 'select')[0]
    expect(sel.chain.find(([m]) => m === 'select')[1]).not.toContain('users')
  })
})
