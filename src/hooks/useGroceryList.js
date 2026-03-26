import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useGroceryList(householdId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('grocery_items')
      .select('*, added_by_user:users!grocery_items_added_by_fkey(name), updated_by_user:users!grocery_items_updated_by_fkey(name)')
      .eq('household_id', householdId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (!error && data) setItems(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    fetchItems()

    const channel = supabase
      .channel('grocery_items_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'grocery_items',
        filter: `household_id=eq.${householdId}`,
      }, () => {
        fetchItems()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [householdId, fetchItems])

  const addItem = async ({ name, qty, unit, store, notes, userId }) => {
    // Get max sort_order for target store so new item lands at the bottom
    const targetStore = store || 'Grocery Store'
    const { data: maxData } = await supabase
      .from('grocery_items')
      .select('sort_order')
      .eq('household_id', householdId)
      .eq('store', targetStore)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (maxData?.[0]?.sort_order ?? 0) + 1

    const newItem = {
      household_id: householdId,
      name: name.trim(),
      qty: qty || null,
      unit: unit || null,
      store: store || null,
      notes: notes || null,
      checked: false,
      sort_order: nextOrder,
      added_by: userId,
      updated_by: userId,
    }
    const { error } = await supabase.from('grocery_items').insert(newItem)

    // Add to item_history for autocomplete
    if (!error) {
      await supabase.from('item_history').upsert(
        { household_id: householdId, name: name.trim() },
        { onConflict: 'household_id,name' }
      )
    }

    return { error }
  }

  const checkItem = async (item, userId) => {
    // Move to recently_bought
    await supabase.from('recently_bought').insert({
      household_id: householdId,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      store: item.store,
      notes: item.notes,
      bought_by: userId,
    })

    // Add to item_history
    await supabase.from('item_history').upsert(
      { household_id: householdId, name: item.name },
      { onConflict: 'household_id,name' }
    )

    // Delete from grocery list
    await supabase.from('grocery_items').delete().eq('id', item.id)
  }

  const uncheckItem = async (item, userId) => {
    // Update checked state
    await supabase.from('grocery_items').update({
      checked: false,
      checked_at: null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
  }

  const deleteItem = async (id) => {
    // Optimistic removal so UI updates immediately
    setItems(prev => prev.filter(i => i.id !== id))
    const { error } = await supabase.from('grocery_items').delete().eq('id', id)
    if (error) {
      console.error('Delete failed:', error)
      fetchItems() // Revert by re-fetching
    }
  }

  const updateItem = async (id, changes, userId) => {
    await supabase.from('grocery_items').update({
      ...changes,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
  }

  const clearChecked = async (userId) => {
    const checkedItems = items.filter(i => i.checked)
    for (const item of checkedItems) {
      await checkItem(item, userId)
    }
  }

  const markChecked = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: true, checked_at: new Date().toISOString() } : i))
  }

  const markUnchecked = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: false, checked_at: null } : i))
  }

  const reorderItems = async (orderedIds, userId) => {
    // Optimistic local update
    setItems(prev => {
      const updates = new Map(orderedIds.map((id, idx) => [id, idx]))
      return prev.map(i => updates.has(i.id) ? { ...i, sort_order: updates.get(i.id) } : i)
    })

    // Batch update in Supabase
    const updates = orderedIds.map((id, index) =>
      supabase.from('grocery_items').update({
        sort_order: index,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
    )
    await Promise.all(updates)
  }

  return { items, loading, addItem, checkItem, uncheckItem, deleteItem, updateItem, clearChecked, markChecked, markUnchecked, reorderItems }
}
