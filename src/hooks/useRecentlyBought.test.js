import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })

import { supabase } from '../lib/supabase'
import { createWrapper } from '../test/queryWrapper'
import { keys } from '../queries/keys'
import { useRecentlyBought } from './useRecentlyBought'
import { useItemHistory } from './useItemHistory'
import { useHouseholdMembers } from './useHouseholdMembers'

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  supabase.setResult('recently_bought', 'select', { data: [{ id: 'rb1', name: 'Milk', qty: 1, unit: 'gal', store: 'Costco', bought_at: '2026-10-10T00:00:00Z' }], error: null })
  supabase.setResult('item_history', 'select', { data: [{ name: 'Milk' }, { name: 'Almond milk' }, { name: 'Eggs' }], error: null })
  supabase.setResult('users', 'select', { data: [{ id: 'u1', name: 'Rob', email: 'r@x' }], error: null })
})

describe('useRecentlyBought', () => {
  it('loads from the cache and addBackToList puts the item on the grocery list optimistically', async () => {
    const { wrapper, qc } = createWrapper()
    qc.setQueryData(keys.grocery('hh'), [])
    supabase.setResult('grocery_items', 'insert', { data: null, error: null })
    const { result } = renderHook(() => useRecentlyBought('hh'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items[0].name).toBe('Milk')
    await act(async () => { await result.current.addBackToList(result.current.items[0], 'u1') })
    expect(qc.getQueryData(keys.grocery('hh')).map(i => i.name)).toEqual(['Milk'])
    const [sent] = supabase.callsFor('grocery_items', 'insert')[0].chain.find(([m]) => m === 'insert')[1]
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(sent).toMatchObject({ name: 'Milk', store: 'Costco', checked: false })
  })
})

describe('useItemHistory', () => {
  it('suggests from the cached names, case-insensitively, max 5', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useItemHistory('hh'), { wrapper })
    await waitFor(() => expect(result.current.history).toHaveLength(3))
    expect(result.current.getSuggestions('milk')).toEqual(['Milk', 'Almond milk'])
    expect(result.current.getSuggestions('')).toEqual([])
  })
})

describe('useHouseholdMembers', () => {
  it('loads members for the household', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useHouseholdMembers('hh'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.members).toEqual([{ id: 'u1', name: 'Rob', email: 'r@x' }])
  })
})
