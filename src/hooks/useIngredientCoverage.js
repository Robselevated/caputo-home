import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { hasMatch } from '../lib/ingredientMatch'
import { keys, STALE } from '../queries/keys'
import { fetchRecipeIngredients, fetchInventory } from '../queries/fetchers'

const EMPTY = []

// "How much of each recipe do we have on hand": the household's recipe
// ingredients plus the shared inventory cache. No channels of its own;
// RealtimeProvider keeps both inputs fresh.
export function useIngredientCoverage(householdId, recipes) {
  const idsKey = recipes.map(r => r.id).join(',')
  const recipeIds = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey])

  const { data: allIngredients = EMPTY } = useQuery({
    queryKey: keys.recipeIngredients(householdId),
    queryFn: () => fetchRecipeIngredients(supabase, householdId),
    enabled: !!householdId && recipeIds.length > 0,
    staleTime: STALE.recipeIngredients,
  })

  const { data: inventory = EMPTY } = useQuery({
    queryKey: keys.inventory(householdId),
    queryFn: () => fetchInventory(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.inventory,
  })

  const inventoryNames = useMemo(
    () => new Set(inventory.map(i => String(i.name ?? '').toLowerCase())),
    [inventory]
  )

  return useMemo(() => {
    const result = {}
    const byRecipe = {}
    for (const ing of allIngredients) {
      if (!byRecipe[ing.recipe_id]) byRecipe[ing.recipe_id] = []
      byRecipe[ing.recipe_id].push(String(ing.name ?? '').toLowerCase())
    }
    for (const recipeId of recipeIds) {
      const ingredients = byRecipe[recipeId] || []
      const total = ingredients.length
      if (total === 0) {
        result[recipeId] = { total: 0, matched: 0, percentage: 0 }
        continue
      }
      const matched = ingredients.filter(name => hasMatch(name, inventoryNames)).length
      result[recipeId] = { total, matched, percentage: Math.round((matched / total) * 100) }
    }
    return result
  }, [allIngredients, inventoryNames, recipeIds])
}
