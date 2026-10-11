import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })

import { supabase } from '../lib/supabase'
import { createWrapper } from '../test/queryWrapper'
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
    await act(async () => { await result.current.clearSection('Dinner') })
    expect(result.current.picks).toHaveLength(0)
  })
})
