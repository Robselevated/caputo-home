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
import { useRecipes, useRecipe, parseRecipeText } from './useRecipes'
import { authFetch } from '../lib/authFetch'

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

describe('importRecipe', () => {
  const parsed = {
    name: 'Chili', description: null, servings: 4, yield_text: '4-6 servings', prep_time: 10, cook_time: null, total_time: null, tags: ['dinner'],
    instructions: '1. Cook.', image_url: 'https://x/i.jpg', source_url: 'https://blog.test/chili', via: 'jsonld',
    ingredients: [
      { section: null, name: 'beans', qty: 1, qty_text: '1-2', unit: 'can', notes: '15 oz' },
      { section: 'Toppings', name: 'cheese', qty: null, qty_text: 'to taste', unit: null, notes: null },
    ],
  }
  const chili = { id: 'r9', household_id: 'hh', name: 'Chili', created_at: '2026-03-01T00:00:00Z' }
  const mockParse = (body) => authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body })

  it('writes the resolved source, a whole-number serving with the yield in notes, and qty_text on every row', async () => {
    mockParse(parsed)
    supabase.setResult('recipes', 'insert', { data: chili, error: null })
    supabase.setResult('recipe_ingredients', 'insert', { data: null, error: null })
    const { result } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.importRecipe('https://www.pinterest.com/pin/1/', 'u1') })
    expect(res.data.id).toBe('r9')
    expect(supabase.callsFor('recipes', 'insert')[0].chain[0][1]).toMatchObject({ servings: 4, source_url: 'https://blog.test/chili', notes: 'Yield: 4-6 servings', prep_time: 10, cook_time: null })
    const rows = supabase.callsFor('recipe_ingredients', 'insert')[0].chain[0][1]
    expect(rows).toEqual([
      expect.objectContaining({ recipe_id: 'r9', name: 'beans', qty: 1, qty_text: '1-2', unit: 'can', notes: '15 oz', section: null, position: 0 }),
      expect.objectContaining({ recipe_id: 'r9', name: 'cheese', qty: null, qty_text: 'to taste', unit: null, section: 'Toppings', position: 1 }),
    ])
  })

  it('treats a servings value that is not a whole number as unknown', async () => {
    mockParse({ ...parsed, servings: 'four', yield_text: null })
    supabase.setResult('recipes', 'insert', { data: chili, error: null })
    supabase.setResult('recipe_ingredients', 'insert', { data: null, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.importRecipe('https://blog.test/chili', 'u1') })
    expect(supabase.callsFor('recipes', 'insert')[0].chain[0][1]).toMatchObject({ servings: null, notes: null })
  })

  it('rolls the recipe back when the ingredients cannot be saved and explains it plainly', async () => {
    mockParse(parsed)
    supabase.setResult('recipes', 'insert', { data: chili, error: null })
    supabase.setResult('recipe_ingredients', 'insert', { data: null, error: { code: '22P02', message: 'invalid input syntax for type numeric: "1-2"' } })
    supabase.setResult('recipes', 'delete', { data: null, error: null })
    const { result } = await renderLoaded()
    let res
    await act(async () => { res = await result.current.importRecipe('https://blog.test/chili', 'u1') })
    expect(res.error).toBe('One of the amounts is not a number we can save. Check the quantities and try again.')
    expect(supabase.callsFor('recipes', 'delete')[0].chain).toEqual(expect.arrayContaining([['eq', 'id', 'r9']]))
    expect(result.current.recipes.map(r => r.id)).toEqual(['r1', 'r2'])
  })
})

describe('replacing ingredients on edit', () => {
  it('uses the replace function when it exists', async () => {
    supabase.setResult('recipes', 'update', { data: null, error: null })
    supabase.setResult('rpc', 'replace_recipe_ingredients', { data: [], error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.updateRecipe('r1', { name: 'Tacos' }, [{ name: 'shells', qty: '12' }, { name: 'salt', qty: 'to taste', unit: 'Tbsp.' }]) })
    const call = supabase.callsFor('rpc', 'replace_recipe_ingredients')[0]
    expect(call.args.p_recipe_id).toBe('r1')
    expect(call.args.p_rows).toEqual([
      expect.objectContaining({ name: 'shells', qty: 12, qty_text: '12', position: 0 }),
      expect.objectContaining({ name: 'salt', qty: null, qty_text: 'to taste', unit: 'tbsp', position: 1 }),
    ])
    expect(supabase.callsFor('recipe_ingredients', 'delete')).toHaveLength(0)
  })

  it('falls back to insert-then-delete while the function is missing, never the reverse', async () => {
    supabase.setResult('recipes', 'update', { data: null, error: null })
    supabase.setResult('rpc', 'replace_recipe_ingredients', { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    supabase.setResult('recipe_ingredients', 'insert', { data: [{ id: 'n1' }, { id: 'n2' }], error: null })
    supabase.setResult('recipe_ingredients', 'delete', { data: null, error: null })
    const { result } = await renderLoaded()
    await act(async () => { await result.current.updateRecipe('r1', { name: 'Tacos' }, [{ name: 'shells', qty: '12' }, { name: 'beef', qty: '1' }]) })
    expect(supabase.calls.filter(c => c.table === 'recipe_ingredients').map(c => c.verb)).toEqual(['insert', 'delete'])
    const del = supabase.callsFor('recipe_ingredients', 'delete')[0].chain
    expect(del).toEqual(expect.arrayContaining([['eq', 'recipe_id', 'r1'], ['not', 'id', 'in', '(n1,n2)']]))
  })
})


describe('parseRecipeText', () => {
  const parsed = { name: 'Pancakes', via: 'text', ingredients: [{ section: null, name: 'flour', qty: 2, qty_text: '2', unit: 'cup', notes: null }] }

  it('posts the text to the paste function and returns the parsed recipe', async () => {
    authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => parsed })
    const res = await parseRecipeText('2 cups flour\nMix and bake.')
    expect(res).toEqual({ parsed })
    expect(authFetch).toHaveBeenCalledTimes(1)
    const [url, init] = authFetch.mock.calls[0]
    expect(url).toBe('/.netlify/functions/parse-recipe-text')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ text: '2 cups flour\nMix and bake.' })
  })

  it('returns the server message on an error reply, and a plain fallback when there is none', async () => {
    authFetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'No ingredients found there.' }) })
    expect(await parseRecipeText('hello')).toEqual({ error: 'No ingredients found there.' })
    authFetch.mockResolvedValue({ ok: false, status: 429, json: async () => { throw new Error('not json') } })
    expect((await parseRecipeText('hello')).error).toMatch(/imported a lot recently/)
    authFetch.mockResolvedValue({ ok: false, status: 504, json: async () => null })
    expect((await parseRecipeText('hello')).error).toMatch(/too long/)
  })
})
