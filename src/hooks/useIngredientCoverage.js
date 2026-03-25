import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export function useIngredientCoverage(householdId, recipes) {
  const [allIngredients, setAllIngredients] = useState([])
  const [inventoryNames, setInventoryNames] = useState(new Set())

  const recipeIds = useMemo(() => recipes.map(r => r.id), [recipes])

  const fetchData = useCallback(async () => {
    if (!householdId || recipeIds.length === 0) return

    // Fetch all recipe ingredients for this household's recipes
    const { data: ingredients } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, name')
      .in('recipe_id', recipeIds)

    if (ingredients) setAllIngredients(ingredients)

    // Fetch all inventory item names (all locations)
    const { data: inventory } = await supabase
      .from('inventory_items')
      .select('name')
      .eq('household_id', householdId)

    if (inventory) {
      setInventoryNames(new Set(inventory.map(i => i.name.toLowerCase())))
    }
  }, [householdId, recipeIds])

  useEffect(() => {
    fetchData()

    // Listen for inventory changes
    const inventoryChannel = supabase
      .channel('coverage_inventory')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `household_id=eq.${householdId}`,
      }, () => fetchData())
      .subscribe()

    // Listen for recipe ingredient changes
    const ingredientChannel = supabase
      .channel('coverage_ingredients')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'recipe_ingredients',
      }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(inventoryChannel)
      supabase.removeChannel(ingredientChannel)
    }
  }, [householdId, fetchData])

  // Compute coverage per recipe
  const coverage = useMemo(() => {
    const result = {}

    // Group ingredients by recipe_id
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

      const matched = ingredients.filter(name => inventoryNames.has(name)).length
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
