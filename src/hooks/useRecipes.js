import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useRecipes(householdId) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRecipes = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })

    if (!error && data) setRecipes(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    fetchRecipes()

    const channel = supabase
      .channel('recipes_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'recipes',
        filter: `household_id=eq.${householdId}`,
      }, () => {
        fetchRecipes()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [householdId, fetchRecipes])

  const getRecipe = async (id) => {
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()

    if (recipeError) return { error: recipeError }

    const { data: ingredients, error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', id)
      .order('position', { ascending: true })

    if (ingredientsError) return { error: ingredientsError }

    return { data: { ...recipe, ingredients } }
  }

  const importRecipe = async (url, userId) => {
    try {
      const response = await fetch('/.netlify/functions/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const error = await response.text()
        return { error: error || 'Failed to parse recipe' }
      }

      const parsed = await response.json()

      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          household_id: householdId,
          name: parsed.name,
          description: parsed.description || null,
          image_url: parsed.image_url || null,
          servings: parsed.servings || null,
          prep_time: parsed.prep_time || null,
          cook_time: parsed.cook_time || null,
          instructions: parsed.instructions || null,
          tags: parsed.tags || [],
          source_url: url,
          created_by: userId,
        })
        .select()
        .single()

      if (recipeError) return { error: recipeError }

      if (parsed.ingredients && parsed.ingredients.length > 0) {
        const ingredients = parsed.ingredients.map((ing, i) => ({
          recipe_id: recipe.id,
          name: ing.name,
          qty: ing.qty || null,
          unit: ing.unit || null,
          notes: ing.notes || null,
          position: i,
        }))

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredients)

        if (ingredientsError) return { error: ingredientsError }
      }

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
        source_url: null,
        created_by: userId,
      })
      .select()
      .single()

    if (recipeError) return { error: recipeError }

    if (recipe.ingredients && recipe.ingredients.length > 0) {
      const ingredients = recipe.ingredients.map((ing, i) => ({
        recipe_id: newRecipe.id,
        name: ing.name,
        qty: ing.qty || null,
        unit: ing.unit || null,
        notes: ing.notes || null,
        position: i,
      }))

      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredients)

      if (ingredientsError) return { error: ingredientsError }
    }

    return { data: newRecipe }
  }

  const reimportRecipe = async (id, sourceUrl) => {
    try {
      const response = await fetch('/.netlify/functions/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      })

      if (!response.ok) {
        const error = await response.text()
        return { error: error || 'Failed to parse recipe' }
      }

      const parsed = await response.json()

      const { error: recipeError } = await supabase
        .from('recipes')
        .update({
          name: parsed.name,
          description: parsed.description || null,
          image_url: parsed.image_url || null,
          servings: parsed.servings || null,
          prep_time: parsed.prep_time || null,
          cook_time: parsed.cook_time || null,
          instructions: parsed.instructions || null,
          tags: parsed.tags || [],
        })
        .eq('id', id)

      if (recipeError) return { error: recipeError }

      // Replace ingredients
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', id)

      if (parsed.ingredients && parsed.ingredients.length > 0) {
        const ingredients = parsed.ingredients.map((ing, i) => ({
          recipe_id: id,
          name: ing.name,
          qty: ing.qty || null,
          unit: ing.unit || null,
          notes: ing.notes || null,
          position: i,
        }))

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredients)

        if (ingredientsError) return { error: ingredientsError }
      }

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
    }
    if ('source_image_url' in updates) {
      updateData.source_image_url = updates.source_image_url || null
    }
    const { error: recipeError } = await supabase
      .from('recipes')
      .update(updateData)
      .eq('id', id)

    if (recipeError) return { error: recipeError }

    // Delete and reinsert ingredients (same pattern as reimportRecipe)
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', id)

    if (ingredients && ingredients.length > 0) {
      const rows = ingredients.map((ing, i) => ({
        recipe_id: id,
        name: ing.name,
        qty: ing.qty || null,
        unit: ing.unit || null,
        notes: ing.notes || null,
        position: i,
      }))

      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(rows)

      if (ingredientsError) return { error: ingredientsError }
    }

    return { data: true }
  }

  const deleteRecipe = async (id) => {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    return { error }
  }

  return {
    recipes,
    loading,
    getRecipe,
    importRecipe,
    reimportRecipe,
    createRecipe,
    updateRecipe,
    deleteRecipe,
  }
}
