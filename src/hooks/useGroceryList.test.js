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
import { createWrapper } from '../test/queryWrapper'

const milk = { id: 'g1', household_id: 'hh', name: 'Milk', qty: 1, unit: 'gallon', store: 'Costco', notes: null, checked: false, sort_order: 0 }

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

async function renderLoaded(existing) {
  const { wrapper, qc } = existing ?? createWrapper()
  const hook = renderHook(() => useGroceryList('hh'), { wrapper })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return { ...hook, qc, wrapper }
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

describe('useGroceryList shared cache + optimistic writes', () => {
  it('remounting within staleTime shows the list at once with no refetch', async () => {
    const first = await renderLoaded()
    first.unmount()
    const { result } = renderHook(() => useGroceryList('hh'), { wrapper: first.wrapper })
    expect(result.current.loading).toBe(false)
    expect(result.current.items).toHaveLength(1)
    await new Promise(r => setTimeout(r, 20))
    expect(supabase.callsFor('grocery_items', 'select')).toHaveLength(1)
  })

  it('addItem shows the row immediately (optimistic) and sends a client-generated id', async () => {
    let resolveInsert
    supabase.setResult('grocery_items', 'insert', () => new Promise(r => { resolveInsert = r }))
    const { result } = await renderLoaded()
    let promise
    await act(async () => { promise = result.current.addItem({ name: 'Eggs', qty: 12, store: 'Costco', userId: 'u1' }); await new Promise(r => setTimeout(r, 0)) })
    expect(result.current.items.map(i => i.name)).toContain('Eggs')
    const ins = supabase.callsFor('grocery_items', 'insert')[0]
    const sent = ins.chain.find(([m]) => m === 'insert')[1]
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/)
    await act(async () => { resolveInsert({ data: { ...sent }, error: null }); await promise })
    expect(result.current.items.filter(i => i.name === 'Eggs')).toHaveLength(1)
  })

  it('updateItem is optimistic and rolls back with a toast when the server rejects it', async () => {
    supabase.setResult('grocery_items', 'update', { data: null, error: { message: 'nope' } })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.updateItem('g1', { qty: 3 }, 'u1') })
    expect(result.current.items[0].qty).toBe(1)
  })

  it('does not open its own realtime channel', async () => {
    await renderLoaded()
    expect(supabase.channel).not.toHaveBeenCalled()
  })
})

describe('useGroceryList rollback is row-level (never a stale snapshot)', () => {
  it('clearChecked with ONE failing check-off restores only that item; the others stay gone', async () => {
    const milk2 = { ...milk, id: 'g1', name: 'Milk', checked: true }
    const eggs = { ...milk, id: 'g2', name: 'Eggs', checked: true }
    const bread = { ...milk, id: 'g3', name: 'Bread', checked: true }
    supabase.setResult('grocery_items', 'select', { data: [milk2, eggs, bread], error: null })
    supabase.setResult('rpc', 'check_off_grocery_item', (args) =>
      args.p_item_id === 'g2'
        ? { data: null, error: { code: '42501', message: 'denied' } }
        : { data: { status: 'ok' }, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.clearChecked('u1') })
    expect(result.current.items.map(i => i.id)).toEqual(['g2'])
  })

  it('two quick adds that both fail each roll back only their own row', async () => {
    supabase.setResult('grocery_items', 'insert', { data: null, error: { message: 'no' } })
    const { result } = await renderLoaded()
    await act(async () => {
      await Promise.all([
        result.current.addItem({ name: 'A', userId: 'u1' }),
        result.current.addItem({ name: 'B', userId: 'u1' }),
      ])
    })
    expect(result.current.items.map(i => i.name)).toEqual(['Milk'])
  })

  it('a failed check-off during a pending delete restores just the checked row', async () => {
    const eggs = { ...milk, id: 'g2', name: 'Eggs' }
    supabase.setResult('grocery_items', 'select', { data: [milk, eggs], error: null })
    let resolveDelete
    supabase.setResult('grocery_items', 'delete', () => new Promise(r => { resolveDelete = r }))
    supabase.setResult('rpc', 'check_off_grocery_item', { data: null, error: { code: '42501', message: 'denied' } })
    const { result } = await renderLoaded()
    let del
    await act(async () => { del = result.current.deleteItem('g2'); await new Promise(r => setTimeout(r, 0)) })
    await act(async () => { await result.current.checkItem(milk, 'u1') })
    expect(result.current.items.map(i => i.id)).toEqual(['g1'])
    await act(async () => { resolveDelete({ data: [{ id: 'g2' }], error: null }); await del })
    expect(result.current.items.map(i => i.id)).toEqual(['g1'])
  })
})
