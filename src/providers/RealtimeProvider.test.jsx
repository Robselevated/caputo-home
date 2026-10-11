import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})

import { supabase } from '../lib/supabase'
import { createWrapper } from '../test/queryWrapper'
import { keys } from '../queries/keys'
import { emitRevalidate } from '../lib/sessionManager'
import { RealtimeProvider } from './RealtimeProvider'

function mount(qc, wrapper, householdId = 'hh') {
  return render(<RealtimeProvider householdId={householdId}><div /></RealtimeProvider>, { wrapper })
}

beforeEach(() => { supabase.reset(); vi.clearAllMocks() })

describe('RealtimeProvider', () => {
  it('opens ONE channel for the household and removes it on unmount', () => {
    const { qc, wrapper } = createWrapper()
    const view = mount(qc, wrapper)
    expect(supabase.channel).toHaveBeenCalledTimes(1)
    const ch = supabase.channels[0]
    const tables = ch.on.mock.calls.map(c => c[1].table)
    expect(tables).toEqual(expect.arrayContaining(['grocery_items', 'inventory_items', 'recently_bought', 'recipes', 'meal_picks', 'recipe_ingredients']))
    view.unmount()
    expect(supabase.removeChannel).toHaveBeenCalledWith(ch)
  })

  it('patches the grocery cache on INSERT/UPDATE/DELETE without refetching', () => {
    const { qc, wrapper } = createWrapper()
    qc.setQueryData(keys.grocery('hh'), [{ id: 'g1', name: 'Milk', checked: false }])
    mount(qc, wrapper)
    act(() => supabase.emit({ table: 'grocery_items', eventType: 'INSERT', old: {}, new: { id: 'g2', name: 'Eggs' } }))
    expect(qc.getQueryData(keys.grocery('hh')).map(r => r.id)).toEqual(['g1', 'g2'])
    act(() => supabase.emit({ table: 'grocery_items', eventType: 'UPDATE', old: { id: 'g2' }, new: { id: 'g2', name: 'Eggs', qty: 12 } }))
    expect(qc.getQueryData(keys.grocery('hh'))[1].qty).toBe(12)
    act(() => supabase.emit({ table: 'grocery_items', eventType: 'DELETE', old: { id: 'g1' }, new: {} }))
    expect(qc.getQueryData(keys.grocery('hh')).map(r => r.id)).toEqual(['g2'])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('keeps a locally checked row checked when its server echo arrives', () => {
    const { qc, wrapper } = createWrapper()
    qc.setQueryData(keys.grocery('hh'), [{ id: 'g1', name: 'Milk', checked: true, checked_at: 't' }])
    mount(qc, wrapper)
    act(() => supabase.emit({ table: 'grocery_items', eventType: 'UPDATE', old: { id: 'g1' }, new: { id: 'g1', name: 'Milk', qty: 2, checked: false, checked_at: null } }))
    expect(qc.getQueryData(keys.grocery('hh'))[0]).toMatchObject({ qty: 2, checked: true })
  })

  it('patches inventory (all locations) and keeps it sorted', () => {
    const { qc, wrapper } = createWrapper()
    qc.setQueryData(keys.inventory('hh'), [{ id: 'b', location: 'pantry', name: 'Rice', category: 'Pasta' }])
    mount(qc, wrapper)
    act(() => supabase.emit({ table: 'inventory_items', eventType: 'INSERT', old: {}, new: { id: 'a', location: 'fridge', name: 'Milk', category: 'Dairy' } }))
    expect(qc.getQueryData(keys.inventory('hh')).map(r => r.id)).toEqual(['a', 'b'])
    act(() => supabase.emit({ table: 'inventory_items', eventType: 'DELETE', old: { id: 'b' }, new: {} }))
    expect(qc.getQueryData(keys.inventory('hh')).map(r => r.id)).toEqual(['a'])
  })

  it('a recipe change patches the grid and invalidates that recipe detail; ingredient changes invalidate coverage', () => {
    const { qc, wrapper } = createWrapper()
    qc.setQueryData(keys.recipes('hh'), [{ id: 'r1', name: 'Tacos' }])
    qc.setQueryData(keys.recipe('r1'), { id: 'r1', name: 'Tacos', ingredients: [] })
    qc.setQueryData(keys.recipeIngredients('hh'), [])
    const spy = vi.spyOn(qc, 'invalidateQueries')
    mount(qc, wrapper)
    act(() => supabase.emit({ table: 'recipes', eventType: 'UPDATE', old: { id: 'r1' }, new: { id: 'r1', name: 'Fish Tacos' } }))
    expect(qc.getQueryData(keys.recipes('hh'))[0].name).toBe('Fish Tacos')
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: keys.recipe('r1') }))
    act(() => supabase.emit({ table: 'recipe_ingredients', eventType: 'INSERT', old: {}, new: { id: 'i1', recipe_id: 'r1', name: 'lime' } }))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: keys.recipeIngredients('hh') }))
  })

  it('a revalidate signal (resume / token refresh) invalidates every query once', () => {
    const { qc, wrapper } = createWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    mount(qc, wrapper)
    act(() => emitRevalidate('resume'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a household id', () => {
    const { qc, wrapper } = createWrapper()
    mount(qc, wrapper, null)
    expect(supabase.channel).not.toHaveBeenCalled()
  })
})

describe('RealtimeProvider channel recovery', () => {
  afterEach(() => vi.useRealTimers())

  it('ignores CHANNEL_ERROR while the socket itself is down (resume reconnects and phoenix rejoins)', () => {
    const { qc, wrapper } = createWrapper()
    mount(qc, wrapper)
    const ch = supabase.channels[0]
    supabase.realtime.isConnected.mockImplementation(() => false)
    act(() => ch.statusCallback('CHANNEL_ERROR'))
    expect(supabase.removeChannel).not.toHaveBeenCalled()
    expect(supabase.channel).toHaveBeenCalledTimes(1)
  })

  it('on a real channel error (socket up) it drops the channel and resubscribes once after a backoff, on a fresh topic', () => {
    vi.useFakeTimers()
    const { qc, wrapper } = createWrapper()
    mount(qc, wrapper)
    const first = supabase.channels[0]
    act(() => first.statusCallback('CHANNEL_ERROR'))
    act(() => first.statusCallback('CHANNEL_ERROR')) // a late duplicate must not double-schedule
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(1500) })
    expect(supabase.channel).toHaveBeenCalledTimes(2)
    expect(supabase.channel.mock.calls[1][0]).not.toBe(supabase.channel.mock.calls[0][0])
    expect(supabase.channel.mock.calls[1][0]).toMatch(/^household:hh/)
    // a stale callback from the dead channel is ignored
    act(() => first.statusCallback('CHANNEL_ERROR'))
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1)
  })
})
