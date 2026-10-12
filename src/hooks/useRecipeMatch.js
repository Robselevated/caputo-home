import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { findMatch, cleanGroceryName } from '../lib/ingredientMatch'
import { convertQty } from '../lib/units'
import { normalizeUnit, formatQty } from '../lib/ingredientParse'
import { queryClient } from '../lib/queryClient'
import { keys } from '../queries/keys'

const isBlank = (unit) => unit == null || String(unit).trim() === ''
const round3 = (n) => Math.round(n * 1000) / 1000

// "8 oz", "1 package": the amount as written plus the canonical unit.
function amountLabel(qty, qtyText, unit) {
  const unitLabel = normalizeUnit(unit) ?? (isBlank(unit) ? '' : String(unit).trim())
  return [qtyText || formatQty(qty), unitLabel].filter(Boolean).join(' ')
}

// How much of the inventory row a recipe line uses, in the row's unit. A blank
// unit on either side is a plain count. null when the pair cannot be compared:
// different families (oz vs cup), different count units (can vs box) or an
// unknown unit.
function usedAmount(item, inv) {
  const recipeUnit = normalizeUnit(item.unit) ?? (isBlank(item.unit) ? 'count' : null)
  const invUnit = normalizeUnit(inv.unit) ?? (isBlank(inv.unit) ? 'count' : null)
  if (!recipeUnit || !invUnit) return null
  return convertQty(item.qty, recipeUnit, invUnit)
}

// Recipe ingredient rows as grocery rows with shoppable names; rows whose
// name cleans to nothing are dropped.
function toGroceryRows(items, build) {
  return items
    .map(item => ({ item, name: cleanGroceryName(item.name) }))
    .filter(({ name }) => name)
    .map(({ item, name }) => build(item, name))
}

export function useRecipeMatch(householdId) {
  const [loading, setLoading] = useState(false)

  const matchIngredients = async (recipeId) => {
    setLoading(true)
    try {
      const { data: recipeIngredients, error: recipeError } = await supabase
        .from('recipe_ingredients')
        .select('id, name, qty, unit, qty_text')
        .eq('recipe_id', recipeId)

      if (recipeError) return { error: recipeError }

      const { data: inventoryItems, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('id, name, qty, unit, location')
        .eq('household_id', householdId)

      if (inventoryError) return { error: inventoryError }

      const inInventory = []
      const missing = []

      for (const ingredient of recipeIngredients) {
        const match = findMatch(ingredient.name, inventoryItems)

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
      const groceryItems = toGroceryRows(missingItems, (item, name) => ({
        household_id: householdId,
        name,
        qty: item.qty ?? null,
        unit: item.unit ?? null,
        store: null,
        notes: `For: ${recipeName}`,
        checked: false,
        added_by: userId,
        updated_by: userId,
      }))
      if (groceryItems.length === 0) return { success: true, added: 0 }

      const { error } = await supabase
        .from('grocery_items')
        .insert(groceryItems)

      if (error) return { error }

      queryClient.invalidateQueries({ queryKey: keys.grocery(householdId) })
      return { success: true, added: groceryItems.length }
    } catch (err) {
      return { error: err.message }
    }
  }

  // "I made this": take each matched ingredient out of the kitchen. A line
  // with no amount ("to taste") or with a unit that cannot be compared to the
  // row's unit is skipped and says why; everything else subtracts the amount
  // converted into the row's unit.
  const useRecipe = async (matchResult, recipeName, userId) => {
    const decremented = []
    const nowOut = []
    const skipped = []
    const updates = []

    for (const item of matchResult.inInventory) {
      const inv = item.inventoryItem
      const qty = Number(item.qty)
      if (item.qty == null || item.qty === '' || !Number.isFinite(qty)) {
        skipped.push({ ...item, reason: 'no amount', detail: item.qty_text || '' })
        continue
      }

      const used = usedAmount(item, inv)
      if (used == null) {
        const detail = `${amountLabel(item.qty, item.qty_text, item.unit)} vs ${amountLabel(inv.qty, null, inv.unit)}`
        skipped.push({ ...item, reason: 'units differ', detail })
        continue
      }

      const oldQty = Number(inv.qty) || 0
      const newQty = Math.max(0, round3(oldQty - used))
      updates.push(
        supabase.from('inventory_items').update({
          qty: newQty,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }).eq('id', inv.id)
      )
      decremented.push({ ...item, oldQty, newQty, used })
      if (newQty === 0) nowOut.push(item)
    }

    // Supabase query builders resolve to { error } instead of rejecting, so a
    // plain Promise.all "success" can still hide failed updates. Inspect each
    // result and report how many didn't persist.
    const results = await Promise.all(updates)
    const failed = results.filter((r) => r?.error)
    if (failed.length > 0) {
      console.error(
        `useRecipe: ${failed.length} inventory update(s) failed`,
        failed.map((f) => f.error?.message)
      )
    }
    if (updates.length > 0) queryClient.invalidateQueries({ queryKey: keys.inventory(householdId) })

    return { decremented, nowOut, skipped, failedCount: failed.length }
  }

  const addDepletedToGroceryList = async (depletedItems, recipeName, userId) => {
    const groceryItems = toGroceryRows(depletedItems, (item, name) => ({
      household_id: householdId,
      name,
      qty: item.inventoryItem?.qty || 1,
      unit: item.inventoryItem?.unit || item.unit,
      store: null,
      notes: `Ran out making: ${recipeName}`,
      checked: false,
      added_by: userId,
      updated_by: userId,
    }))
    if (groceryItems.length === 0) return { error: null }

    const { error } = await supabase
      .from('grocery_items')
      .insert(groceryItems)

    if (!error) queryClient.invalidateQueries({ queryKey: keys.grocery(householdId) })
    return { error }
  }

  return {
    loading,
    matchIngredients,
    addMissingToGroceryList,
    useRecipe,
    addDepletedToGroceryList,
  }
}
