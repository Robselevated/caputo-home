import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useRecipeSuggestions(householdId) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSuggestions = useCallback(async () => {
    if (!householdId) return

    setLoading(true)
    setError(null)
    setSuggestions([])

    try {
      // Fetch inventory from all 3 locations
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('name, qty, location, category')
        .eq('household_id', householdId)
        .gt('qty', 0)

      if (itemsError) {
        setError('Failed to read inventory')
        setLoading(false)
        return
      }

      if (!items || items.length === 0) {
        setError('No items in inventory. Add items to pantry, fridge, or freezer first.')
        setLoading(false)
        return
      }

      const response = await fetch('/.netlify/functions/suggest-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: items }),
      })

      if (!response.ok) {
        setError('Failed to generate suggestions')
        setLoading(false)
        return
      }

      const data = await response.json()
      setSuggestions(data)
    } catch (err) {
      setError('Error: ' + err.message)
    }

    setLoading(false)
  }, [householdId])

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
  }
}
