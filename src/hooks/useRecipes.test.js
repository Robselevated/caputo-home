import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../lib/authFetch', () => ({ authFetch: vi.fn() }))
vi.mock('../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })

import { supabase } from '../lib/supabase'
import { createWrapper } from '../test/queryWrapper'
import { keys } from '../queries/keys'
import { useRecipes, useRecipe } from './useRecipes'

const tacos = { id: 'r1', household_id: 'hh', name: 'Tacos', image_url: null, tags: [], created_at: '2026-01-02T00:00:00Z' }
const soup = { id: 'r2', household_id: 'hh', name: 'Soup', image_url: null, tags: [], created_at: '2026-01-01T00:00:00Z' }

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  supabase.setResult('recipes', 'select', (record) => {
    const isDetail = record.chain.some(([m]) => m === 'single')
    return isDetail
      ? { data: { ...tacos, instructions: 'Cook.', ingredients: [{ position: 1, name: 'b' }, { position: 0, name: 'a' }] }, error: null }
      : { data: [tacos, soup], error: null }
  })
})

async function renderLoaded(existing) {
  const { wrapper, qc } = existing ?? createWrapper()
  const hook = renderHook(() => useRecipes('hh'), { wrapper })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return { ...hook, qc, wrapper }
}

describe('useRecipes', () => {
  it('loads the grid once and serves remounts from cache', async () => {
    const first = await renderLoaded()
    first.unmount()
    const { result } = renderHook(() => useRecipes('hh'), { wrapper: first.wrapper })
    expect(result.current.recipes.map(r => r.id)).toEqual(['r1', 'r2'])
    await new Promise(r => setTimeout(r, 10))
    expect(supabase.callsFor('recipes', 'select')).toHaveLength(1)
    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('createRecipe puts the new recipe first in the grid and seeds its detail, with no refetch', async () => {
    supabase.setResult('recipes', 'insert', { data: { id: 'r3', household_id: 'hh', name: 'Pie', created_at: '2026-02-01T00:00:00Z' }, error: null })
    supabase.setResult('recipe_ingredients', 'insert', { data: null, error: null })
    const { result, qc } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.createRecipe({ name: 'Pie', ingredients: [{ name: 'apples', qty: '3' }] }, 'u1') })
    expect(res.data.id).toBe('r3')
    expect(result.current.recipes.map(r => r.id)).toEqual(['r3', 'r1', 'r2'])
    expect(qc.getQueryData(keys.recipe('r3'))).toMatchObject({ id: 'r3', name: 'Pie' })
    expect(qc.getQueryData(keys.recipe('r3')).ingredients[0]).toMatchObject({ name: 'apples' })
    expect(supabase.callsFor('recipes', 'select')).toHaveLength(1)
  })

  it('deleteRecipe removes optimistically and restores with a toast on error', async () => {
    supabase.setResult('recipes', 'delete', { data: null, error: { message: 'denied' } })
    const { result } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.deleteRecipe('r1') })
    expect(res.error).toBeTruthy()
    expect(result.current.recipes.map(r => r.id)).toEqual(['r1', 'r2'])
  })

  it('getRecipe reads through the detail cache (second call is free)', async () => {
    const { result } = await renderLoaded()
    let a, b
    await act(async () => { a = await result.current.getRecipe('r1') })
    await act(async () => { b = await result.current.getRecipe('r1') })
    expect(a.data.ingredients.map(i => i.name)).toEqual(['a', 'b'])
    expect(b.data).toEqual(a.data)
    const detailSelects = supabase.callsFor('recipes', 'select').filter(c => c.chain.some(([m]) => m === 'single'))
    expect(detailSelects).toHaveLength(1)
  })
})

describe('useRecipe', () => {
  it('paints at once from the grid row as a placeholder, then fills in the detail', async () => {
    const { wrapper, qc } = createWrapper()
    qc.setQueryData(keys.recipes('hh'), [tacos, soup])
    const { result } = renderHook(() => useRecipe('r1'), { wrapper })
    expect(result.current.loading).toBe(false)
    expect(result.current.recipe).toMatchObject({ id: 'r1', name: 'Tacos' })
    expect(result.current.isPlaceholderData).toBe(true)
    await waitFor(() => expect(result.current.recipe.instructions).toBe('Cook.'))
    expect(result.current.isPlaceholderData).toBe(false)
    expect(result.current.recipe.ingredients.map(i => i.name)).toEqual(['a', 'b'])
  })

  it('reports not found when the detail query errors and nothing is cached', async () => {
    supabase.setResult('recipes', 'select', { data: null, error: { message: 'no rows', code: 'PGRST116' } })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRecipe('nope'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.recipe).toBeUndefined()
    expect(result.current.error).toBeTruthy()
  })
})
