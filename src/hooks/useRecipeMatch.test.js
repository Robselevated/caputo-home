import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})

import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { keys } from '../queries/keys'
import { useRecipeMatch } from './useRecipeMatch'

beforeEach(() => { supabase.reset(); vi.clearAllMocks() })

describe('useRecipeMatch keeps the shared cache honest', () => {
  it('addMissingToGroceryList and addDepletedToGroceryList refresh the grocery cache', async () => {
    supabase.setResult('grocery_items', 'insert', { data: null, error: null })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRecipeMatch('hh'))
    await act(async () => { await result.current.addMissingToGroceryList([{ name: 'limes', qty: 2, unit: null }], 'Tacos', 'u1', 'hh') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.grocery('hh') })
    spy.mockClear()
    await act(async () => { await result.current.addDepletedToGroceryList([{ name: 'rice', inventoryItem: { qty: 0, unit: 'bags' } }], 'Tacos', 'u1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.grocery('hh') })
    spy.mockRestore()
  })

  it('"I made this" decrements refresh the kitchen cache', async () => {
    supabase.setResult('inventory_items', 'update', { data: null, error: null })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRecipeMatch('hh'))
    const match = { inInventory: [{ name: 'rice', qty: 1, unit: 'bags', inventoryItem: { id: 'a', qty: 2, unit: 'bags' } }] }
    await act(async () => { await result.current.useRecipe(match, 'Tacos', 'u1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.inventory('hh') })
    spy.mockRestore()
  })
})
