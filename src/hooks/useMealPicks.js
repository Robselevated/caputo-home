import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useMealPicks(householdId) {
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPicks = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('meal_picks')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })

    if (!error && data) setPicks(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    fetchPicks()

    const channel = supabase
      .channel('meal_picks_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meal_picks',
        filter: `household_id=eq.${householdId}`,
      }, () => {
        fetchPicks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [householdId, fetchPicks])

  const addPick = async ({ userId, recipeId, name, notes, imageUrl }) => {
    const { error } = await supabase.from('meal_picks').insert({
      household_id: householdId,
      user_id: userId,
      recipe_id: recipeId || null,
      name: name.trim(),
      notes: notes?.trim() || null,
      image_url: imageUrl || null,
    })
    return { error }
  }

  const removePick = async (id) => {
    setPicks(prev => prev.filter(p => p.id !== id))
    const { error } = await supabase.from('meal_picks').delete().eq('id', id)
    if (error) fetchPicks()
    return { error }
  }

  const clearMyPicks = async (userId) => {
    setPicks(prev => prev.filter(p => p.user_id !== userId))
    const { error } = await supabase
      .from('meal_picks')
      .delete()
      .eq('household_id', householdId)
      .eq('user_id', userId)
    if (error) fetchPicks()
    return { error }
  }

  return { picks, loading, addPick, removePick, clearMyPicks }
}
