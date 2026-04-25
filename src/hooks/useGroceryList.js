import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGroceryItems, getCachedGroceryItems, queueWrite } from '../lib/db'
import { getDefaultLocation, DEFAULT_UNITS } from '../lib/constants'

export function useGroceryList(householdId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!householdId) return

    if (!navigator.onLine) {
      const cached = await getCachedGroceryItems()
      if (cached.length > 0) setItems(cached)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('grocery_items')
      .select('*, added_by_user:users!grocery_items_added_by_fkey(name), updated_by_user:users!grocery_items_updated_by_fkey(name)')
      .eq('household_id', householdId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (!error && data) {
      setItems(data)
      cacheGroceryItems(data)
    } else {
      // Online but fetch failed — fall back to cache
      const cached = await getCachedGroceryItems()
      if (cached.length > 0) setItems(cached)
    }
    setLoading(false)
  }, [householdId])

  // Subscribe to real-time changes
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

  // Keep IndexedDB cache in sync with local state
  useEffect(() => {
    if (items.length > 0) {
      cacheGroceryItems(items)
    }
  }, [items])

  // Re-fetch from Supabase when connectivity returns
  useEffect(() => {
    const handleOnline = () => fetchItems()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fetchItems])

  const addItem = async ({ name, qty, unit, store, notes, userId }) => {
    const targetStore = store || 'Grocery Store'

    if (!navigator.onLine) {
      const maxSort = items
        .filter(i => i.store === targetStore)
        .reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0)

      const newItem = {
        id: crypto.randomUUID(),
        household_id: householdId,
        name: name.trim(),
        qty: qty || null,
        unit: unit || null,
        store: store || null,
        notes: notes || null,
        checked: false,
        sort_order: maxSort + 1,
        added_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
      }
      setItems(prev => [...prev, newItem])
      await queueWrite({
        type: 'insert',
        data: {
          household_id: householdId,
          name: name.trim(),
          qty: qty || null,
          unit: unit || null,
          store: store || null,
          notes: notes || null,
          checked: false,
          sort_order: maxSort + 1,
          added_by: userId,
          updated_by: userId,
        },
      })
      return { error: null }
    }

    // Online path — unchanged
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

    if (!error) {
      await supabase.from('item_history').upsert(
        { household_id: householdId, name: name.trim() },
        { onConflict: 'household_id,name' }
      )
    }

    return { error }
  }

  const checkItem = async (item, userId) => {
    if (!navigator.onLine) {
      setItems(prev => prev.filter(i => i.id !== item.id))
      await queueWrite({
        type: 'check',
        item: { ...item },
        householdId,
        userId,
      })
      // Queue inventory add for when back online
      const { location, category } = getDefaultLocation(item.name)
      await queueWrite({
        type: 'inventory_add',
        data: {
          household_id: householdId,
          name: item.name,
          qty: item.qty || 1,
          unit: item.unit || DEFAULT_UNITS[location]?.[category] || 'count',
          location,
          category,
          updated_by: userId,
        },
      })
      return
    }

    // Online path — unchanged
    const { error: insertError } = await supabase.from('recently_bought').insert({
      household_id: householdId,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      store: item.store,
      notes: item.notes,
      bought_by: userId,
    })

    if (insertError) {
      console.error('Failed to add to recently_bought:', insertError)
      fetchItems()
      return
    }

    await supabase.from('item_history').upsert(
      { household_id: householdId, name: item.name },
      { onConflict: 'household_id,name' }
    )

    // Auto-add to inventory (increment qty if already exists)
    const { location, category } = getDefaultLocation(item.name)
    const addQty = item.qty || 1
    const { data: existing } = await supabase
      .from('inventory_items')
      .select('id, qty')
      .eq('household_id', householdId)
      .ilike('name', item.name)
      .limit(1)
      .maybeSingle()

    if (existing) {
      await supabase.from('inventory_items').update({
        qty: (existing.qty || 0) + addQty,
        updated_by: userId,
      }).eq('id', existing.id)
    } else {
      await supabase.from('inventory_items').insert({
        household_id: householdId,
        name: item.name,
        qty: addQty,
        unit: item.unit || DEFAULT_UNITS[location]?.[category] || 'count',
        location,
        category,
        updated_by: userId,
      })
    }

    const { error: deleteError } = await supabase.from('grocery_items').delete().eq('id', item.id)
    if (deleteError) {
      console.error('Failed to delete grocery item:', deleteError)
      fetchItems()
    }
  }

  const uncheckItem = async (item, userId) => {
    await supabase.from('grocery_items').update({
      checked: false,
      checked_at: null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
  }

  const deleteItem = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id))

    if (!navigator.onLine) {
      await queueWrite({ type: 'delete', itemId: id })
      return
    }

    const { error } = await supabase.from('grocery_items').delete().eq('id', id)
    if (error) {
      console.error('Delete failed:', error)
      fetchItems()
    }
  }

  const updateItem = async (id, changes, userId) => {
    const fullChanges = {
      ...changes,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    if (!navigator.onLine) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...fullChanges } : i))
      await queueWrite({ type: 'update', itemId: id, changes: fullChanges })
      return
    }

    await supabase.from('grocery_items').update(fullChanges).eq('id', id)
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

    if (!navigator.onLine) {
      await queueWrite({ type: 'reorder', orderedIds, userId })
      return
    }

    const updates = orderedIds.map((id, index) =>
      supabase.from('grocery_items').update({
        sort_order: index,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
    )
    const results = await Promise.allSettled(updates)
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      console.error(`Reorder: ${failed.length} of ${results.length} updates failed`)
      fetchItems()
    }
  }

  return { items, loading, addItem, checkItem, uncheckItem, deleteItem, updateItem, clearChecked, markChecked, markUnchecked, reorderItems }
}
