import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queueWrite } from '../lib/db'
import { toast } from '../components/ui/Toast'
import { DEFAULT_UNITS } from '../lib/constants'
import { normalizeName } from '../lib/normalizeName'
import { sortInventory } from '../lib/inventoryRealtime'
import { upsertById, removeById } from '../lib/realtimeCache'
import { keys, STALE } from '../queries/keys'
import { fetchInventory } from '../queries/fetchers'
import { mergeInventoryItem, updateInventoryItem, deleteInventoryItem, insertGroceryItem } from '../queries/writes'

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
const EMPTY = []

// Kitchen inventory for one location, served from the ONE all-locations
// cache (keys.inventory). Writes are optimistic against that cache and roll
// back with a toast; realtime patches arrive through RealtimeProvider.
export function useInventory(householdId, location) {
  const qc = useQueryClient()
  const key = keys.inventory(householdId)

  const { data: allItems = EMPTY, isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchInventory(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.inventory,
  })

  const items = useMemo(
    () => sortInventory(allItems.filter(i => i.location === location)),
    [allItems, location]
  )

  const setAll = (updater) => qc.setQueryData(key, (prev) => updater(prev ?? []))
  const snapshot = () => qc.getQueryData(key)
  const findRow = (id) => (snapshot() ?? []).find(i => i.id === id)

  const addItem = async ({ name, qty, unit, category, subcategory, notes, userId }) => {
    if (!householdId) return { error: 'No household' }
    const cleanName = (name || '').trim()
    const row = {
      household_id: householdId,
      name: cleanName,
      qty: qty ?? 1,
      unit: unit || DEFAULT_UNITS[location]?.[category] || 'count',
      location,
      category,
      subcategory: subcategory || null,
      notes: notes || null,
      updated_by: userId,
    }

    await qc.cancelQueries({ queryKey: key })
    const k = normalizeName(cleanName)
    const existing = (snapshot() ?? []).find(i => i.location === location && normalizeName(i.name) === k)
    const tempId = existing ? existing.id : crypto.randomUUID()
    setAll(prev => existing
      ? prev.map(i => (i.id === existing.id ? { ...i, qty: (i.qty || 0) + (row.qty || 1) } : i))
      : sortInventory([...prev, { ...row, id: tempId, created_at: new Date().toISOString() }]))

    if (isOffline()) {
      await queueWrite({ type: 'inventory_merge', data: row })
      return { error: null, queued: true, merged: !!existing }
    }

    try {
      const { merged, item } = await mergeInventoryItem(supabase, { ...row, id: existing ? undefined : tempId })
      if (item) {
        setAll(prev => sortInventory(upsertById(item.id !== tempId ? removeById(prev, tempId) : prev, item)))
      }
      return { error: null, merged, item }
    } catch (error) {
      // roll back only what this add changed
      if (existing) setAll(prev => prev.map(i => (i.id === existing.id ? { ...i, qty: existing.qty } : i)))
      else setAll(prev => removeById(prev, tempId))
      toast({ message: `Couldn't add ${cleanName}`, tone: 'error' })
      return { error }
    }
  }

  const updateItem = async (id, changes, userId) => {
    if (!householdId) return { error: 'No household' }
    const fullChanges = { ...changes, updated_by: userId, updated_at: new Date().toISOString() }
    await qc.cancelQueries({ queryKey: key })
    const prevRow = findRow(id)
    setAll(prev => prev.map(i => (i.id === id ? { ...i, ...fullChanges } : i)))

    if (isOffline()) {
      await queueWrite({ type: 'inventory_update', itemId: id, changes: fullChanges })
      return { error: null, queued: true }
    }

    try {
      await updateInventoryItem(supabase, id, fullChanges)
      return { error: null }
    } catch (error) {
      // Revert only the fields we changed so a concurrent realtime update survives.
      if (prevRow) {
        setAll(prev => prev.map(i => {
          if (i.id !== id) return i
          const reverted = { ...i }
          for (const field of Object.keys(fullChanges)) reverted[field] = prevRow[field]
          return reverted
        }))
      }
      toast({ message: `Couldn't update ${prevRow?.name ?? 'item'}`, tone: 'error' })
      return { error }
    }
  }

  const updateQty = (id, newQty, userId) => updateItem(id, { qty: Math.max(0, newQty) }, userId)

  const deleteItem = async (id) => {
    if (!householdId) return { error: 'No household' }
    await qc.cancelQueries({ queryKey: key })
    const prevRow = findRow(id)
    setAll(prev => removeById(prev, id))

    if (isOffline()) {
      await queueWrite({ type: 'inventory_delete', itemId: id })
      return { error: null, queued: true }
    }

    try {
      const { alreadyGone } = await deleteInventoryItem(supabase, id)
      if (alreadyGone) {
        console.warn('inventory delete affected 0 rows (already gone or blocked by RLS):', id)
        return { error: null, alreadyGone: true }
      }
      return { error: null }
    } catch (error) {
      if (prevRow) setAll(prev => sortInventory(upsertById(prev, prevRow)))
      toast({
        message: `Couldn't remove ${prevRow?.name ?? 'item'}`,
        tone: 'error',
        action: { label: 'Retry', onClick: () => deleteItem(id) },
      })
      return { error }
    }
  }

  const addToGroceryList = async (item, userId) => {
    if (!householdId) return { error: 'No household' }
    const groceryKey = keys.grocery(householdId)
    const row = {
      id: crypto.randomUUID(),
      household_id: householdId,
      name: item.name,
      qty: item.qty || 1,
      unit: item.unit || null,
      store: null,
      notes: null,
      checked: false,
      added_by: userId,
      updated_by: userId,
      created_at: new Date().toISOString(),
    }
    qc.setQueryData(groceryKey, prev => (prev ? [...prev, row] : prev))
    try {
      const saved = await insertGroceryItem(supabase, row)
      if (saved) qc.setQueryData(groceryKey, prev => (prev ? upsertById(prev, saved) : prev))
      toast({ message: `${item.name} added to grocery list` })
      return { error: null }
    } catch (error) {
      qc.setQueryData(groceryKey, prev => (prev ? removeById(prev, row.id) : prev))
      toast({ message: `Couldn't add ${item.name} to the grocery list`, tone: 'error' })
      return { error }
    }
  }

  return { items, allItems, loading: isPending, addItem, updateQty, updateItem, deleteItem, addToGroceryList }
}
