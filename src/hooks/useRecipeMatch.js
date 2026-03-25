import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useRecipeMatch(householdId) {
  const [loading, setLoading] = useState(false)

  const matchIngredients = async (recipeId) => {
    setLoading(true)
    try {
      const { data: recipeIngredients, error: recipeError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipeId)

      if (recipeError) return { error: recipeError }

      const { data: inventoryItems, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('household_id', householdId)

      if (inventoryError) return { error: inventoryError }

      const inInventory = []
      const missing = []

      for (const ingredient of recipeIngredients) {
        const match = inventoryItems.find(item =>
          item.name.toLowerCase() === ingredient.name.toLowerCase()
        )

        if (match) {
          inInventory.push({ ...ingredient, inventoryItem: match })
        } else {
          missing.push(ingredient)
        }
      }

      return { data: { inInventory, missing } }
    } catch (err) {
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const addMissingToGroceryList = async (missingItems, recipeName, userId, householdId) => {
    try {
      const groceryItems = missingItems.map(item => ({
        household_id: householdId,
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        store: null,
        notes: `For: ${recipeName}`,
        checked: false,
        added_by: userId,
        updated_by: userId,
      }))

      const { error } = await supabase
        .from('grocery_items')
        .insert(groceryItems)

      if (error) return { error }

      return { success: true }
    } catch (err) {
      return { error: err.message }
    }
  }

  return {
    loading,
    matchIngredients,
    addMissingToGroceryList,
  }
}
