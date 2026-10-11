import { withQueryTimeout } from '../lib/sessionManager'

// Query functions. Each takes the supabase client explicitly (testable with
// the fake), is bounded by withQueryTimeout, and THROWS on error so TanStack
// Query marks the query errored while the cached data stays on screen.

export function toError(e) {
  const err = new Error(e?.message || 'Request failed')
  err.code = e?.code
  err.cause = e
  return err
}

async function run(builder) {
  const { data, error } = await withQueryTimeout(builder)
  if (error) throw toError(error)
  return data
}

export const RECIPE_GRID_COLUMNS =
  'id, household_id, name, description, image_url, source_image_url, servings, prep_time, cook_time, tags, source_url, created_by, created_at'

export async function fetchGroceryItems(client, householdId) {
  return run(
    client.from('grocery_items').select('*')
      .eq('household_id', householdId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  )
}

export async function fetchInventory(client, householdId) {
  return run(
    client.from('inventory_items').select('*')
      .eq('household_id', householdId)
      .order('category').order('subcategory').order('name')
  )
}

export async function fetchRecentlyBought(client, householdId) {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  return run(
    client.from('recently_bought').select('*')
      .eq('household_id', householdId)
      .gte('bought_at', cutoff)
      .order('bought_at', { ascending: false })
  )
}

export async function fetchItemHistory(client, householdId) {
  const rows = await run(
    client.from('item_history').select('name').eq('household_id', householdId).order('name')
  )
  return (rows || []).map(r => r.name)
}

export async function fetchRecipes(client, householdId) {
  return run(
    client.from('recipes').select(RECIPE_GRID_COLUMNS)
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
  )
}

export async function fetchRecipe(client, id) {
  const data = await run(
    client.from('recipes').select('*, ingredients:recipe_ingredients(*)').eq('id', id).single()
  )
  if (data?.ingredients) {
    data.ingredients = [...data.ingredients].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }
  return data
}

export async function fetchRecipeIngredients(client, householdId) {
  const rows = await run(
    client.from('recipe_ingredients')
      .select('recipe_id, name, recipes!inner(household_id)')
      .eq('recipes.household_id', householdId)
  )
  return (rows || []).map(({ recipe_id, name }) => ({ recipe_id, name }))
}

export async function fetchMealPicks(client, householdId) {
  return run(
    client.from('meal_picks').select('*').eq('household_id', householdId).order('created_at', { ascending: true })
  )
}

export async function fetchMembers(client, householdId) {
  return run(
    client.from('users').select('id, name, email').eq('household_id', householdId).order('name')
  )
}
