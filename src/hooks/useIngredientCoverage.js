import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { raceTimeout, onRevalidate } from '../lib/sessionManager'
import { hasMatch } from '../lib/ingredientMatch'

export function useIngredientCoverage(householdId, recipes) {
  const [allIngredients, setAllIngredients] = useState([])
  const [inventoryNames, setInventoryNames] = useState(new Set())
  const debounceRef = useRef(null)

  // Key on the ids themselves, not the array identity: every recipes refetch
  // used to tear down both channels and refetch coverage.
  const idsKey = recipes.map(r => r.id).join(',')
  const recipeIds = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey])

  const fetchData = useCallback(async () => {
    if (!householdId || recipeIds.length === 0) return

    const [ingredientRes, inventoryRes] = await raceTimeout(
      Promise.all([
        supabase
          .from('recipe_ingredients')
          .select('recipe_id, name')
          .in('recipe_id', recipeIds),
        supabase
          .from('inventory_items')
          .select('name')
          .eq('household_id', householdId),
      ]),
      8000,
      [{ data: null }, { data: null }]
    )

    if (ingredientRes.data) setAllIngredients(ingredientRes.data)
    if (inventoryRes.data) {
      setInventoryNames(new Set(inventoryRes.data.map(i => i.name.toLowerCase())))
    }
  }, [householdId, recipeIds])

  // Debounced refetch to prevent cascade of rapid re-fetches
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchData, 500)
  }, [fetchData])

  useEffect(() => {
    fetchData()

    const inventoryChannel = supabase
      .channel('coverage_inventory')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `household_id=eq.${householdId}`,
      }, debouncedFetch)
      .subscribe()

    const offRevalidate = onRevalidate(() => fetchData())

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(inventoryChannel)
      offRevalidate()
    }
  }, [householdId, fetchData, debouncedFetch])

  // Compute coverage per recipe
  const coverage = useMemo(() => {
    const result = {}

    const byRecipe = {}
    for (const ing of allIngredients) {
      if (!byRecipe[ing.recipe_id]) byRecipe[ing.recipe_id] = []
      byRecipe[ing.recipe_id].push(ing.name.toLowerCase())
    }

    for (const recipeId of recipeIds) {
      const ingredients = byRecipe[recipeId] || []
      const total = ingredients.length
      if (total === 0) {
        result[recipeId] = { total: 0, matched: 0, percentage: 0 }
        continue
      }

      const matched = ingredients.filter(name => hasMatch(name, inventoryNames)).length
      result[recipeId] = {
        total,
        matched,
        percentage: Math.round((matched / total) * 100),
      }
    }

    return result
  }, [allIngredients, inventoryNames, recipeIds])

  return coverage
}
