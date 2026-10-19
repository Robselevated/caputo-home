import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })

import { supabase } from '../lib/supabase'
import { createWrapper } from '../test/queryWrapper'
import { chainHas } from '../test/fakeSupabase'
import { useMealPicks } from './useMealPicks'

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  supabase.setResult('meal_picks', 'select', { data: [{ id: 'p1', name: 'Tacos', section: 'Dinner', created_at: '2026-01-01T00:00:00Z' }], error: null })
})

async function renderLoaded() {
  const { wrapper, qc } = createWrapper()
  const hook = renderHook(() => useMealPicks('hh'), { wrapper })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return { ...hook, qc }
}

describe('useMealPicks', () => {
  it('addPick shows the pick immediately with a client id and keeps the server row once', async () => {
    let resolveInsert
    supabase.setResult('meal_picks', 'insert', () => new Promise(r => { resolveInsert = r }))
    const { result } = await renderLoaded()
    let promise
    await act(async () => { promise = result.current.addPick({ userId: 'u1', name: 'Soup', section: 'Lunch' }); await new Promise(r => setTimeout(r, 0)) })
    expect(result.current.picks.map(p => p.name)).toEqual(['Tacos', 'Soup'])
    const sent = supabase.callsFor('meal_picks', 'insert')[0].chain.find(([m]) => m === 'insert')[1]
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/)
    await act(async () => { resolveInsert({ data: { ...sent, created_at: '2026-01-02T00:00:00Z' }, error: null }); await promise })
    expect(result.current.picks.filter(p => p.name === 'Soup')).toHaveLength(1)
  })

  it('removePick is optimistic and restores on error; clearSection drops a whole section', async () => {
    supabase.setResult('meal_picks', 'delete', { data: null, error: { message: 'x' } })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.removePick('p1') })
    expect(result.current.picks).toHaveLength(1)
    supabase.setResult('meal_picks', 'delete', { data: null, error: null })
    // 'Dinner' is a legacy section name that renders under Rob's Picks.
    await act(async () => { await result.current.clearSection("Rob's Picks") })
    expect(result.current.picks).toHaveLength(0)
  })

  it('clearSection removes null and legacy-named picks shown in that section, by id', async () => {
    supabase.setResult('meal_picks', 'select', { data: [
      { id: 'a', name: 'Tacos', section: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', name: 'Soup', section: "Cheyenne's Picks", created_at: '2026-01-02T00:00:00Z' },
      { id: 'c', name: 'Pasta', section: "Cheyene's Picks", created_at: '2026-01-03T00:00:00Z' },
      { id: 'd', name: 'Curry', section: "Rob's Picks", created_at: '2026-01-04T00:00:00Z' },
    ], error: null })
    supabase.setResult('meal_picks', 'delete', { data: null, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.clearSection("Cheyene's Picks") })
    expect(result.current.picks.map(p => p.id)).toEqual(['a', 'd'])
    const del = supabase.callsFor('meal_picks', 'delete')[0]
    expect(chainHas(del, 'in', 'id', ['b', 'c'])).toBe(true)
    await act(async () => { await result.current.clearSection("Rob's Picks") })
    expect(result.current.picks).toHaveLength(0)
    expect(chainHas(supabase.callsFor('meal_picks', 'delete')[1], 'in', 'id', ['a', 'd'])).toBe(true)
  })
})
