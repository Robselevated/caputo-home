import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })

import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { createWrapper } from '../test/queryWrapper'
import { useRestaurants, parseScore, averageScore } from './useRestaurants'

const row = (id, extra = {}) => ({ id, place_id: `place-${id}`, name: id.toUpperCase(), status: 'list', sort_order: 0, created_at: '2026-01-01T00:00:00Z', ...extra })
const PLACE = { placeId: 'place-new', name: 'Wild Sage', cuisine: 'American Restaurant', address: 'Spokane', mapsUrl: 'https://maps.google.com/?cid=1' }

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  supabase.setResult('restaurants', 'select', { data: [row('a', { sort_order: 0 }), row('b', { sort_order: 1 }), row('z', { status: 'archived', sort_order: 5 })], error: null })
  supabase.setResult('restaurant_ratings', 'select', { data: [], error: null })
  supabase.setResult('restaurant_notes', 'select', { data: [], error: null })
})

async function renderLoaded() {
  const { wrapper, qc } = createWrapper()
  const hook = renderHook(() => useRestaurants('hh'), { wrapper })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return { ...hook, qc }
}

describe('parseScore and averageScore', () => {
  it('accepts 0 to 10 in tenths', () => {
    expect(parseScore('9.7')).toBe(9.7)
    expect(parseScore(' 10 ')).toBe(10)
    expect(parseScore('8,5')).toBe(8.5)
    expect(parseScore('0')).toBe(0)
    for (const bad of ['10.1', '11', '9.75', '-1', 'abc', '', '9.']) expect(parseScore(bad)).toBeNull()
  })

  it('averages to one decimal', () => {
    expect(averageScore([{ score: 9.7 }, { score: '8.5' }])).toBe(9.1)
    expect(averageScore([])).toBeNull()
  })
})

describe('useRestaurants', () => {
  it('adds a Google place to the bottom of the list', async () => {
    supabase.setResult('restaurants', 'insert', { data: null, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.addRestaurant(PLACE, 'u1') })
    const sent = supabase.callsFor('restaurants', 'insert')[0].chain.find(([m]) => m === 'insert')[1]
    expect(sent).toMatchObject({ household_id: 'hh', place_id: 'place-new', name: 'Wild Sage', cuisine: 'American Restaurant', status: 'list', sort_order: 2, created_by: 'u1' })
    expect(result.current.restaurants.filter(r => r.status === 'list').map(r => r.name)).toEqual(['A', 'B', 'Wild Sage'])
  })

  it('skips a place that is already saved', async () => {
    const { result } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.addRestaurant({ ...PLACE, placeId: 'place-z' }, 'u1') })
    expect(res.error).toBe('duplicate')
    expect(supabase.callsFor('restaurants', 'insert')).toHaveLength(0)
    expect(toast).toHaveBeenCalledWith({ message: 'Z is already in Been there' })
  })

  it('reorders through the RPC and rolls back on failure', async () => {
    const { result } = await renderLoaded()
    await act(async () => { await result.current.reorder(['b', 'a']) })
    expect(supabase.rpc).toHaveBeenCalledWith('set_restaurant_sort_order', { p_ids: ['b', 'a'] })
    expect(result.current.restaurants.filter(r => r.status === 'list').map(r => r.id)).toEqual(['b', 'a'])

    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    await act(async () => { await result.current.reorder(['a', 'b']) })
    expect(result.current.restaurants.filter(r => r.status === 'list').map(r => r.id)).toEqual(['b', 'a'])
  })

  it('We went archives with a visit date; Back to list puts it at the bottom', async () => {
    supabase.setResult('restaurants', 'update', { data: null, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.markVisited('a') })
    const a = result.current.restaurants.find(r => r.id === 'a')
    expect(a.status).toBe('archived')
    expect(a.visited_at).toBeTruthy()
    await act(async () => { await result.current.moveToList('a') })
    const back = result.current.restaurants.find(r => r.id === 'a')
    expect(back).toMatchObject({ status: 'list', sort_order: 2 })
  })

  it('saves and clears a per-person score', async () => {
    const { result } = await renderLoaded()
    await act(async () => { await result.current.setRating('z', 'u1', 9.7) })
    expect(result.current.ratings).toEqual([{ restaurant_id: 'z', user_id: 'u1', household_id: 'hh', score: 9.7 }])
    expect(supabase.callsFor('restaurant_ratings', 'upsert')).toHaveLength(1)
    await act(async () => { await result.current.setRating('z', 'u1', null) })
    expect(result.current.ratings).toEqual([])
    expect(supabase.callsFor('restaurant_ratings', 'delete')).toHaveLength(1)
  })

  it('adds a trimmed note and restores a note whose delete fails', async () => {
    supabase.setResult('restaurant_notes', 'insert', { data: null, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.addNote('z', 'u1', '  Rob got the steak  ') })
    expect(result.current.notes.map(n => n.body)).toEqual(['Rob got the steak'])
    supabase.setResult('restaurant_notes', 'delete', { data: null, error: { message: 'x' } })
    await act(async () => { await result.current.removeNote(result.current.notes[0].id) })
    expect(result.current.notes).toHaveLength(1)
  })
})
