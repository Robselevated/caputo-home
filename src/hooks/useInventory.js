import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { withQueryTimeout, onRevalidate } from '../lib/sessionManager'
import { queueWrite } from '../lib/db'
import { toast } from '../components/ui/Toast'
import { DEFAULT_UNITS } from '../lib/constants'
import { normalizeName } from '../lib/normalizeName'
import { applyInventoryChange, sortInventory } from '../lib/inventoryRealtime'

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export function useInventory(householdId, location) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const fetchItems = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await withQueryTimeout(
      supabase
        .from('inventory_items')
        .select('*')
        .eq('household_id', householdId)
        .eq('location', location)
        .order('category')
        .order('subcategory')
        .order('name')
    )
    if (!error && data) setItems(data)
    setLoading(false)
  }, [householdId, location])

  useEffect(() => {
    fetchItems()

    // Realtime patches the list in place. DELETE is keyed on old.id only: with
    // the default REPLICA IDENTITY the payload carries nothing else, which is
    // why deletes from the other phone used to be ignored here.
    const channel = supabase
      .channel(`inventory_${location}_changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `household_id=eq.${householdId}`,
      }, (payload) => {
        setItems(prev => applyInventoryChange(prev, payload, location))
      })
      .subscribe()

    const offRevalidate = onRevalidate(() => fetchItems())

    return () => {
      supabase.removeChannel(channel)
      offRevalidate()
    }
  }, [householdId, location, fetchItems])

  const upsertLocal = (row) => {
    if (!row) return
    setItems(prev => applyInventoryChange(prev, { eventType: 'INSERT', new: row, old: {} }, location))
  }

  const addItem = async ({ name, qty, unit, category, subcategory, notes, userId }) => {
    if (!householdId) return { error: 'No household' }
    const cleanName = (name || '').trim()
    const defaultUnit = DEFAULT_UNITS[location]?.[category] || 'count'
    const row = {
      household_id: householdId,
      name: cleanName,
      qty: qty ?? 1,
      unit: unit || defaultUnit,
      location,
      category,
      subcategory: subcategory || null,
      notes: notes || null,
      updated_by: userId,
    }

    if (isOffline()) {
      const key = normalizeName(cleanName)
      const existing = itemsRef.current.find(i => normalizeName(i.name) === key)
      if (existing) {
        setItems(prev => prev.map(i => (i.id === existing.id ? { ...i, qty: (i.qty || 0) + (row.qty || 1) } : i)))
      } else {
        upsertLocal({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() })
      }
      await queueWrite({ type: 'inventory_merge', data: row })
      return { error: null, queued: true, merged: !!existing }
    }

    const { data, error } = await supabase.rpc('merge_inventory_item', {
      p_household_id: householdId,
      p_name: cleanName,
      p_qty: row.qty,
      p_unit: row.unit,
      p_location: location,
      p_category: category,
      p_subcategory: row.subcategory,
      p_notes: row.notes,
    })

    if (!error && data?.item) {
      upsertLocal(data.item)
      return { error: null, merged: !!data.merged, item: data.item }
    }

    if (error?.code === 'PGRST202') {
      // Function not deployed yet: plain insert so the app still works.
      const { data: inserted, error: insErr } = await supabase
        .from('inventory_items').insert(row).select().single()
      if (insErr) {
        toast({ message: `Couldn't add ${cleanName}`, tone: 'error' })
        return { error: insErr }
      }
      upsertLocal(inserted)
      return { error: null, merged: false, item: inserted }
    }

    toast({ message: `Couldn't add ${cleanName}`, tone: 'error' })
    return { error: error || { message: 'Unexpected response' } }
  }

  const updateItem = async (id, changes, userId) => {
    if (!householdId) return { error: 'No household' }
    const prevRow = itemsRef.current.find(i => i.id === id)
    const fullChanges = {
      ...changes,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...fullChanges } : i)))

    if (isOffline()) {
      await queueWrite({ type: 'inventory_update', itemId: id, changes: fullChanges })
      return { error: null, queued: true }
    }

    const { error } = await supabase.from('inventory_items').update(fullChanges).eq('id', id).select('id')
    if (error) {
      if (prevRow) setItems(prev => prev.map(i => (i.id === id ? prevRow : i)))
      toast({ message: `Couldn't update ${prevRow?.name ?? 'item'}`, tone: 'error' })
      return { error }
    }
    return { error: null }
  }

  const updateQty = async (id, newQty, userId) => {
    if (!householdId) return { error: 'No household' }
    return updateItem(id, { qty: Math.max(0, newQty) }, userId)
  }

  const deleteItem = async (id) => {
    if (!householdId) return { error: 'No household' }
    const prevRow = itemsRef.current.find(i => i.id === id)
    setItems(prev => prev.filter(i => i.id !== id))

    if (isOffline()) {
      await queueWrite({ type: 'inventory_delete', itemId: id })
      return { error: null, queued: true }
    }

    // .select('id') makes a silent 0-row delete (RLS, already gone) visible.
    const { data, error } = await supabase.from('inventory_items').delete().eq('id', id).select('id')
    if (error) {
      if (prevRow) setItems(prev => sortInventory([...prev.filter(i => i.id !== id), prevRow]))
      toast({
        message: `Couldn't remove ${prevRow?.name ?? 'item'}`,
        tone: 'error',
        action: { label: 'Retry', onClick: () => deleteItem(id) },
      })
      return { error }
    }
    if (!data || data.length === 0) return { error: null, alreadyGone: true }
    return { error: null }
  }

  const addToGroceryList = async (item, userId) => {
    if (!householdId) return { error: 'No household' }
    const { error } = await supabase.from('grocery_items').insert({
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
    if (error) {
      toast({ message: `Couldn't add ${item.name} to the grocery list`, tone: 'error' })
      return { error }
    }
    toast({ message: `${item.name} added to grocery list` })
    return { error: null }
  }

  return { items, loading, addItem, updateQty, updateItem, deleteItem, addToGroceryList }
}
