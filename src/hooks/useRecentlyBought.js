import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useRecentlyBought(householdId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('recently_bought')
      .select('*, bought_by_user:users!recently_bought_bought_by_fkey(name)')
      .eq('household_id', householdId)
      .order('bought_at', { ascending: false })

    if (!error && data) setItems(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    fetchItems()

    const channel = supabase
      .channel('recently_bought_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'recently_bought',
        filter: `household_id=eq.${householdId}`,
      }, () => {
        fetchItems()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [householdId, fetchItems])

  const addBackToList = async (item, userId) => {
    // Add back to grocery_items
    await supabase.from('grocery_items').insert({
      household_id: householdId,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      store: item.store,
      notes: item.notes,
      checked: false,
      added_by: userId,
      updated_by: userId,
    })
  }

  return { items, loading, addBackToList }
}
