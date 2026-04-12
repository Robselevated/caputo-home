import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_UNITS } from '../lib/constants'

export function useInventory(householdId, location) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, updated_by_user:users!inventory_items_updated_by_fkey(name)')
      .eq('household_id', householdId)
      .eq('location', location)
      .order('category')
      .order('subcategory')
      .order('name')

    if (!error && data) setItems(data)
    setLoading(false)
  }, [householdId, location])

  useEffect(() => {
    fetchItems()

    const channel = supabase
      .channel(`inventory_${location}_changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `household_id=eq.${householdId}`,
      }, (payload) => {
        const isOurLocation = payload.new?.location === location || payload.old?.location === location
        if (!isOurLocation) return

        if (payload.eventType === 'DELETE') {
          setItems(prev => prev.filter(item => item.id !== payload.old.id))
        } else if (payload.eventType === 'UPDATE' && payload.new?.location === location) {
          setItems(prev => prev.map(item =>
            item.id === payload.new.id ? { ...item, ...payload.new } : item
          ))
        } else {
          // INSERT or location changed, refetch to get proper ordering and joins
          fetchItems()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [householdId, location, fetchItems])

  const addItem = async ({ name, qty, unit, category, subcategory, notes, userId }) => {
    if (!householdId) return { error: 'No household' }
    const defaultUnit = DEFAULT_UNITS[location]?.[category] || 'count'
    const { error } = await supabase.from('inventory_items').insert({
      household_id: householdId,
      name: name.trim(),
      qty: qty || 0,
      unit: unit || defaultUnit,
      location,
      category,
      subcategory: subcategory || null,
      notes: notes || null,
      updated_by: userId,
    })
    return { error }
  }

  const updateQty = async (id, newQty, userId) => {
    if (!householdId) return
    const clamped = Math.max(0, newQty)
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, qty: clamped } : item
    ))
    await supabase.from('inventory_items').update({
      qty: clamped,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
  }

  const updateItem = async (id, changes, userId) => {
    if (!householdId) return
    await supabase.from('inventory_items').update({
      ...changes,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
  }

  const deleteItem = async (id) => {
    if (!householdId) return { error: 'No household' }
    setItems(prev => prev.filter(item => item.id !== id))
    const { error } = await supabase.from('inventory_items').delete().eq('id', id)
    if (error) {
      fetchItems()
      return { error }
    }
    return { error: null }
  }

  const addToGroceryList = async (item, userId) => {
    if (!householdId) return
    await supabase.from('grocery_items').insert({
      household_id: householdId,
      name: item.name,
      qty: item.qty || 1,
      unit: item.unit || null,
      store: null,
      notes: null,
      checked: false,
      added_by: userId,
      updated_by: userId,
    })
  }

  return { items, loading, addItem, updateQty, updateItem, deleteItem, addToGroceryList }
}
