import { describe, it, expect, beforeEach } from 'vitest'
import { createFakeSupabase, chainHas } from '../test/fakeSupabase'
import {
  fetchGroceryItems, fetchInventory, fetchRecentlyBought, fetchItemHistory,
  fetchRecipes, fetchRecipe, fetchRecipeIngredients, fetchMealPicks, fetchMembers,
} from './fetchers'

let client
beforeEach(() => { client = createFakeSupabase() })

describe('fetchers', () => {
  it('fetchGroceryItems selects plain columns (no users joins) for the household', async () => {
    client.setResult('grocery_items', 'select', { data: [{ id: 'g1' }], error: null })
    const rows = await fetchGroceryItems(client, 'hh')
    expect(rows).toEqual([{ id: 'g1' }])
    const call = client.callsFor('grocery_items', 'select')[0]
    expect(call.chain.find(([m]) => m === 'select')[1]).toBe('*')
    expect(chainHas(call, 'eq', 'household_id', 'hh')).toBe(true)
  })

  it('throws on a supabase error so the query enters error state and keeps cached data', async () => {
    client.setResult('grocery_items', 'select', { data: null, error: { message: 'boom' } })
    await expect(fetchGroceryItems(client, 'hh')).rejects.toThrow('boom')
  })

  it('fetchInventory loads ALL locations in one query', async () => {
    client.setResult('inventory_items', 'select', { data: [], error: null })
    await fetchInventory(client, 'hh')
    const call = client.callsFor('inventory_items', 'select')[0]
    expect(chainHas(call, 'eq', 'household_id', 'hh')).toBe(true)
    expect(call.chain.some(([m, col]) => m === 'eq' && col === 'location')).toBe(false)
  })

  it('fetchRecentlyBought limits to the last 14 days, newest first', async () => {
    client.setResult('recently_bought', 'select', { data: [], error: null })
    await fetchRecentlyBought(client, 'hh')
    const call = client.callsFor('recently_bought', 'select')[0]
    const gte = call.chain.find(([m]) => m === 'gte')
    expect(gte[1]).toBe('bought_at')
    expect(Date.now() - new Date(gte[2]).getTime()).toBeGreaterThan(13 * 24 * 3600 * 1000)
    expect(chainHas(call, 'order', 'bought_at', { ascending: false })).toBe(true)
  })

  it('fetchItemHistory returns plain names', async () => {
    client.setResult('item_history', 'select', { data: [{ name: 'Milk' }, { name: 'Eggs' }], error: null })
    expect(await fetchItemHistory(client, 'hh')).toEqual(['Milk', 'Eggs'])
  })

  it('fetchRecipes selects grid columns only (never instructions)', async () => {
    client.setResult('recipes', 'select', { data: [], error: null })
    await fetchRecipes(client, 'hh')
    const sel = client.callsFor('recipes', 'select')[0].chain.find(([m]) => m === 'select')[1]
    expect(sel).toContain('id')
    expect(sel).toContain('image_url')
    expect(sel).not.toContain('instructions')
  })

  it('fetchRecipe loads one recipe with its ingredients sorted by position', async () => {
    client.setResult('recipes', 'select', { data: { id: 'r1', ingredients: [{ position: 2, name: 'b' }, { position: 1, name: 'a' }] }, error: null })
    const recipe = await fetchRecipe(client, 'r1')
    expect(recipe.ingredients.map(i => i.name)).toEqual(['a', 'b'])
    const call = client.callsFor('recipes', 'select')[0]
    expect(chainHas(call, 'eq', 'id', 'r1')).toBe(true)
    expect(chainHas(call, 'single')).toBe(true)
  })

  it('fetchRecipeIngredients is scoped to the household through the recipes join', async () => {
    client.setResult('recipe_ingredients', 'select', { data: [{ recipe_id: 'r1', name: 'rice' }], error: null })
    const rows = await fetchRecipeIngredients(client, 'hh')
    expect(rows).toEqual([{ recipe_id: 'r1', name: 'rice' }])
    const call = client.callsFor('recipe_ingredients', 'select')[0]
    expect(call.chain.find(([m]) => m === 'select')[1]).toContain('recipes!inner')
    expect(chainHas(call, 'eq', 'recipes.household_id', 'hh')).toBe(true)
  })

  it('fetchRecipeIngredients and fetchItemHistory page past the 1000-row cap in a stable order', async () => {
    const pageOf = (n, offset) => Array.from({ length: n }, (_, i) => ({ recipe_id: 'r', name: `ing${offset + i}` }))
    client.setResult('recipe_ingredients', 'select', (record) => {
      const [, from] = record.chain.find(([m]) => m === 'range')
      return { data: from === 0 ? pageOf(1000, 0) : pageOf(5, 1000), error: null }
    })
    const rows = await fetchRecipeIngredients(client, 'hh')
    expect(rows).toHaveLength(1005)
    const calls = client.callsFor('recipe_ingredients', 'select')
    expect(calls).toHaveLength(2)
    expect(chainHas(calls[0], 'range', 0, 999)).toBe(true)
    expect(chainHas(calls[1], 'range', 1000, 1999)).toBe(true)
    expect(chainHas(calls[0], 'order', 'recipe_id')).toBe(true)
    expect(chainHas(calls[0], 'order', 'id')).toBe(true)

    client.setResult('item_history', 'select', (record) => {
      const [, from] = record.chain.find(([m]) => m === 'range')
      return { data: from === 0 ? pageOf(1000, 0) : [], error: null }
    })
    expect(await fetchItemHistory(client, 'hh')).toHaveLength(1000)
    expect(client.callsFor('item_history', 'select')).toHaveLength(2)
  })

  it('fetchMealPicks and fetchMembers scope by household', async () => {
    client.setResult('meal_picks', 'select', { data: [], error: null })
    client.setResult('users', 'select', { data: [], error: null })
    await fetchMealPicks(client, 'hh')
    await fetchMembers(client, 'hh')
    expect(chainHas(client.callsFor('meal_picks', 'select')[0], 'eq', 'household_id', 'hh')).toBe(true)
    expect(chainHas(client.callsFor('users', 'select')[0], 'eq', 'household_id', 'hh')).toBe(true)
  })
})
