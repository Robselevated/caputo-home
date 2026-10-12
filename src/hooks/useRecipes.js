import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { authFetch } from '../lib/authFetch'
import { normalizeIngredientQty } from '../lib/parseQty'
import { normalizeUnit } from '../lib/ingredientParse'
import { friendlyDbError } from '../features/cookbook/recipeFormat'
import { toast } from '../components/ui/Toast'
import { upsertById, removeById } from '../lib/realtimeCache'
import { keys, STALE } from '../queries/keys'
import { fetchRecipes, fetchRecipe } from '../queries/fetchers'
import { invalidateDebounced } from '../queries/invalidate'

const EMPTY = []
const newestFirst = (rows) => [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))

function importErrorMessage(response, errBody) {
  if (errBody?.error) return errBody.error
  if (response.status === 429) return "You've imported a lot recently. Give it a few minutes and try again."
  if (response.status === 413) return 'Those photos are too big. Try fewer at once.'
  if (response.status === 504 || response.status === 502) {
    return 'That site took too long to read. Try again, or add it with Type it.'
  }
  return `Couldn't import that recipe (error ${response.status}). Try again, or add it with Type it.`
}

async function parseRecipeUrl(url) {
  const response = await authFetch('/.netlify/functions/parse-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) {
    const errBody = await response.json().catch(() => null)
    return { error: importErrorMessage(response, errBody) }
  }
  return { parsed: await response.json() }
}

// Pasted recipe text -> the import contract, through the paste function.
// Standalone (not part of the hook) so the paste form can call it directly.
export async function parseRecipeText(text) {
  const response = await authFetch('/.netlify/functions/parse-recipe-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    const errBody = await response.json().catch(() => null)
    return { error: importErrorMessage(response, errBody) }
  }
  return { parsed: await response.json() }
}

const toInt = (v) => {
  const n = typeof v === 'string' ? parseInt(v, 10) : v
  return Number.isInteger(n) && n > 0 ? n : null
}

// Ingredient rows the database accepts: a numeric qty for math, the written
// amount in qty_text, the unit in canonical form (unknown units kept as typed).
function buildIngredientRows(recipeId, ingredients) {
  return (ingredients || [])
    .filter(ing => ing && String(ing.name || '').trim())
    .map((ing, i) => {
      const norm = normalizeIngredientQty(ing)
      return {
        recipe_id: recipeId,
        name: String(norm.name).trim(),
        qty: norm.qty,
        qty_text: norm.qty_text,
        unit: normalizeUnit(ing.unit) || (ing.unit ? String(ing.unit).trim() : null) || null,
        notes: norm.notes || null,
        section: ing.section || null,
        position: i,
      }
    })
}

// What the parse functions return -> a recipes row. Servings and times must
// be whole numbers; a yield like "4-6 servings" is kept in the notes.
function toRecipeRow(parsed, { url } = {}) {
  const servings = toInt(parsed.servings)
  const yieldText = parsed.yield_text && String(parsed.yield_text).trim()
  const yieldNote = yieldText && yieldText !== String(servings ?? '') ? `Yield: ${yieldText}` : null
  return {
    name: parsed.name,
    description: parsed.description || null,
    image_url: parsed.image_url || null,
    servings,
    prep_time: toInt(parsed.prep_time),
    cook_time: toInt(parsed.cook_time),
    instructions: parsed.instructions || null,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    notes: yieldNote,
    ...(url !== undefined ? { source_url: parsed.source_url || url } : {}),
  }
}

const GRID_FIELDS = ['name', 'description', 'image_url', 'source_image_url', 'servings', 'prep_time', 'cook_time', 'tags', 'source_url']
const pickGrid = (obj) => Object.fromEntries(GRID_FIELDS.filter(f => f in obj).map(f => [f, obj[f]]))

// Recipe grid (light columns) on the shared cache, plus the write operations
// the cookbook pages use. Each write patches the grid and the detail cache in
// place; RealtimeProvider does the same for the other phone.
export function useRecipes(householdId) {
  const qc = useQueryClient()
  const key = keys.recipes(householdId)

  const { data: recipes = EMPTY, isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchRecipes(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.recipes,
  })

  const putInGrid = (recipe) => qc.setQueryData(key, prev => (prev ? newestFirst(upsertById(prev, recipe)) : prev))
  const patchGrid = (id, fields) => qc.setQueryData(key, prev => (prev ? prev.map(r => (r.id === id ? { ...r, ...fields } : r)) : prev))
  const seedDetail = (recipe, ingredients) => qc.setQueryData(keys.recipe(recipe.id), { ...recipe, ingredients })
  const touchIngredients = () => invalidateDebounced(qc, keys.recipeIngredients(householdId))

  const getRecipe = async (id) => {
    try {
      const data = await qc.fetchQuery({
        queryKey: keys.recipe(id),
        queryFn: () => fetchRecipe(supabase, id),
        staleTime: STALE.recipe,
      })
      return { data }
    } catch (error) {
      return { error }
    }
  }

  const insertIngredients = async (recipeId, ingredients) => {
    const rows = buildIngredientRows(recipeId, ingredients)
    if (rows.length === 0) return { rows: [], ids: [] }
    const { data, error } = await supabase.from('recipe_ingredients').insert(rows).select('id')
    return { rows, ids: (data || []).map(r => r.id), error }
  }

  const importRecipe = async (url, userId) => {
    try {
      const { parsed, error: parseError } = await parseRecipeUrl(url)
      if (parseError) return { error: parseError }

      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({ household_id: householdId, ...toRecipeRow(parsed, { url }), created_by: userId })
        .select()
        .single()
      if (recipeError) return { error: friendlyDbError(recipeError) }

      const { rows, error: ingredientsError } = await insertIngredients(recipe.id, parsed.ingredients)
      if (ingredientsError) {
        // Never leave a recipe with no ingredients behind.
        await supabase.from('recipes').delete().eq('id', recipe.id)
        return { error: friendlyDbError(ingredientsError) }
      }

      putInGrid(recipe)
      seedDetail(recipe, rows)
      touchIngredients()
      return { data: recipe }
    } catch (err) {
      return { error: err.message }
    }
  }

  const createRecipe = async (recipe, userId) => {
    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        household_id: householdId,
        name: recipe.name,
        description: recipe.description || null,
        image_url: recipe.image_url || null,
        source_image_url: recipe.source_image_url || null,
        servings: recipe.servings || null,
        prep_time: recipe.prep_time || null,
        cook_time: recipe.cook_time || null,
        instructions: recipe.instructions || null,
        tags: recipe.tags || [],
        notes: recipe.notes || null,
        source_url: null,
        created_by: userId,
      })
      .select()
      .single()
    if (recipeError) return { error: recipeError }

    const { rows, error: ingredientsError } = await insertIngredients(newRecipe.id, recipe.ingredients)
    if (ingredientsError) {
      // Don't leave an orphan recipe with no ingredients behind.
      await supabase.from('recipes').delete().eq('id', newRecipe.id)
      return { error: ingredientsError }
    }

    putInGrid(newRecipe)
    seedDetail(newRecipe, rows)
    touchIngredients()
    return { data: newRecipe }
  }

  const replaceIngredients = async (id, ingredients) => {
    const rows = buildIngredientRows(id, ingredients).map(({ recipe_id, ...rest }) => rest)
    // One statement on the server; while the function is not deployed, insert
    // the new rows first and only then clear the old ones, so a failure can
    // never leave the recipe with no ingredients.
    const { error: rpcError } = await supabase.rpc('replace_recipe_ingredients', { p_recipe_id: id, p_rows: rows })
    if (!rpcError) return { error: null }
    if (rpcError.code !== 'PGRST202' && !/could not find the function/i.test(rpcError.message || '')) return { error: rpcError }
    const { ids, error: insertError } = await insertIngredients(id, ingredients)
    if (insertError) return { error: insertError }
    let del = supabase.from('recipe_ingredients').delete().eq('recipe_id', id)
    if (ids.length) del = del.not('id', 'in', `(${ids.join(',')})`)
    const { error: deleteError } = await del
    return { error: deleteError || null }
  }

  const reimportRecipe = async (id, sourceUrl) => {
    try {
      const { parsed, error: parseError } = await parseRecipeUrl(sourceUrl)
      if (parseError) return { error: parseError }

      const { notes: yieldNote, ...fields } = toRecipeRow(parsed)
      if (yieldNote) fields.notes = yieldNote
      const { error: recipeError } = await supabase.from('recipes').update(fields).eq('id', id)
      if (recipeError) return { error: recipeError }

      const { error } = await replaceIngredients(id, parsed.ingredients)
      if (error) return { error }

      patchGrid(id, pickGrid(fields))
      qc.invalidateQueries({ queryKey: keys.recipe(id) })
      touchIngredients()
      return { data: true }
    } catch (err) {
      return { error: err.message }
    }
  }

  const updateRecipe = async (id, updates, ingredients) => {
    const updateData = {
      name: updates.name,
      description: updates.description || null,
      image_url: updates.image_url || null,
      servings: updates.servings || null,
      prep_time: updates.prep_time || null,
      cook_time: updates.cook_time || null,
      instructions: updates.instructions || null,
      tags: updates.tags || [],
      notes: updates.notes || null,
    }
    if ('source_image_url' in updates) {
      updateData.source_image_url = updates.source_image_url || null
    }
    const { error: recipeError } = await supabase.from('recipes').update(updateData).eq('id', id)
    if (recipeError) return { error: recipeError }

    const { error } = await replaceIngredients(id, ingredients)
    if (error) return { error }

    patchGrid(id, pickGrid(updateData))
    qc.invalidateQueries({ queryKey: keys.recipe(id) })
    touchIngredients()
    return { data: true }
  }

  const deleteRecipe = async (id) => {
    await qc.cancelQueries({ queryKey: key })
    const row = (qc.getQueryData(key) ?? []).find(r => r.id === id)
    qc.setQueryData(key, prev => (prev ? removeById(prev, id) : prev))
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) {
      if (row) qc.setQueryData(key, prev => newestFirst(upsertById(prev ?? [], row)))
      toast({ message: `Couldn't delete ${row?.name ?? 'recipe'}`, tone: 'error' })
      return { error }
    }
    qc.removeQueries({ queryKey: keys.recipe(id) })
    touchIngredients()
    return { error: null }
  }

  return {
    recipes,
    loading: isPending,
    getRecipe,
    importRecipe,
    reimportRecipe,
    createRecipe,
    updateRecipe,
    deleteRecipe,
  }
}

// One recipe with its ingredients. Paints at once from the grid row (as
// placeholder data) while the full row loads.
export function useRecipe(id) {
  const qc = useQueryClient()
  const { data, isPending, isPlaceholderData, error, refetch } = useQuery({
    queryKey: keys.recipe(id),
    queryFn: () => fetchRecipe(supabase, id),
    enabled: !!id,
    staleTime: STALE.recipe,
    placeholderData: () => {
      for (const [, rows] of qc.getQueriesData({ queryKey: ['recipes'] })) {
        const hit = Array.isArray(rows) ? rows.find(r => r.id === id) : null
        if (hit) return hit
      }
      return undefined
    },
  })
  return { recipe: data, loading: isPending && !data, isPlaceholderData, error, refetch }
}
