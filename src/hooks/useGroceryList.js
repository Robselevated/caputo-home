import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queueWrite } from '../lib/db'
import { toast } from '../components/ui/Toast'
import { checkOffGroceryItem, checkOffParams } from '../lib/checkOff'
import { upsertById, removeById } from '../lib/realtimeCache'
import { keys, STALE } from '../queries/keys'
import { fetchGroceryItems } from '../queries/fetchers'
import { insertGroceryItem, updateGroceryItem, deleteGroceryItem, setGrocerySortOrder } from '../queries/writes'
import { invalidateDebounced } from '../queries/invalidate'

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
const EMPTY = []

const byOrder = (rows) => [...rows].sort((a, b) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))

// Grocery list on the shared query cache. Every write is optimistic (the row
// changes before the request), rolls back with a toast on failure, and queues
// when offline. Realtime patches arrive through RealtimeProvider.
export function useGroceryList(householdId) {
  const qc = useQueryClient()
  const key = keys.grocery(householdId)

  const { data: items = EMPTY, isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchGroceryItems(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.grocery,
  })

  const setAll = (updater) => qc.setQueryData(key, (prev) => updater(prev ?? []))
  const snapshot = () => qc.getQueryData(key)
  const findRow = (id) => (snapshot() ?? []).find(i => i.id === id)
  // Rollbacks are ROW-level, never a whole-list snapshot: concurrent writes
  // (clear-checked fires one per item) must not resurrect each other's rows.
  const putBack = (row) => { if (row) setAll(prev => byOrder(upsertById(prev, row))) }
  const takeOut = (id) => setAll(prev => removeById(prev, id))

  const addItem = async ({ name, qty, unit, store, notes, userId }) => {
    if (!householdId) return { error: 'No household' }
    const cleanName = (name || '').trim()
    const targetStore = store || 'Grocery Store'
    const current = snapshot() ?? []
    const maxSort = current
      .filter(i => (i.store || 'Grocery Store') === targetStore)
      .reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0)
    const row = {
      id: crypto.randomUUID(),
      household_id: householdId,
      name: cleanName,
      qty: qty || null,
      unit: unit || null,
      store: store || null,
      notes: notes || null,
      checked: false,
      sort_order: maxSort + 1,
      added_by: userId,
      updated_by: userId,
    }

    await qc.cancelQueries({ queryKey: key })
    setAll(prev => byOrder([...prev, { ...row, created_at: new Date().toISOString() }]))

    if (isOffline()) {
      await queueWrite({ type: 'insert', data: row })
      return { error: null, queued: true }
    }

    try {
      const saved = await insertGroceryItem(supabase, row)
      if (saved) setAll(prev => byOrder(upsertById(prev, saved)))
      // Autocomplete memory; not worth blocking on.
      supabase.from('item_history')
        .upsert({ household_id: householdId, name: cleanName }, { onConflict: 'household_id,name' })
        .then(() => invalidateDebounced(qc, keys.itemHistory(householdId)))
        .catch(() => {})
      return { error: null }
    } catch (error) {
      takeOut(row.id)
      toast({ message: `Couldn't add ${cleanName}`, tone: 'error' })
      return { error }
    }
  }

  const checkItem = async (item, userId) => {
    if (!householdId) return { error: 'No household' }
    await qc.cancelQueries({ queryKey: key })
    const prevRow = findRow(item.id) ?? item
    takeOut(item.id)

    if (isOffline()) {
      const { location, category, unit } = checkOffParams(item)
      await queueWrite({ type: 'check', item: { ...item }, householdId, userId, location, category, unit })
      return { error: null, queued: true }
    }

    const { error } = await checkOffGroceryItem(supabase, { item, householdId, userId })
    if (error) {
      console.error('Check-off failed:', error)
      putBack(prevRow)
      toast({ message: `Couldn't check off ${item.name}`, tone: 'error' })
      return { error }
    }
    // The RPC wrote recently_bought + item_history + a kitchen row; realtime
    // patches those caches, and this (burst-safe) invalidate is the fallback.
    invalidateDebounced(qc, keys.recentlyBought(householdId))
    invalidateDebounced(qc, keys.inventory(householdId))
    return { error: null }
  }

  const updateItem = async (id, changes, userId) => {
    if (!householdId) return { error: 'No household' }
    const fullChanges = { ...changes, updated_by: userId, updated_at: new Date().toISOString() }
    await qc.cancelQueries({ queryKey: key })
    const prevRow = findRow(id)
    setAll(prev => byOrder(prev.map(i => (i.id === id ? { ...i, ...fullChanges } : i))))

    if (isOffline()) {
      await queueWrite({ type: 'update', itemId: id, changes: fullChanges })
      return { error: null, queued: true }
    }

    try {
      await updateGroceryItem(supabase, id, fullChanges)
      return { error: null }
    } catch (error) {
      if (prevRow) {
        setAll(prev => byOrder(prev.map(i => {
          if (i.id !== id) return i
          const reverted = { ...i }
          for (const field of Object.keys(fullChanges)) reverted[field] = prevRow[field]
          return reverted
        })))
      }
      toast({ message: `Couldn't update ${prevRow?.name ?? 'item'}`, tone: 'error' })
      return { error }
    }
  }

  const uncheckItem = (item, userId) => updateItem(item.id, { checked: false, checked_at: null }, userId)

  const deleteItem = async (id) => {
    if (!householdId) return { error: 'No household' }
    await qc.cancelQueries({ queryKey: key })
    const prevRow = findRow(id)
    takeOut(id)

    if (isOffline()) {
      await queueWrite({ type: 'delete', itemId: id })
      return { error: null, queued: true }
    }

    try {
      await deleteGroceryItem(supabase, id)
      return { error: null }
    } catch (error) {
      putBack(prevRow)
      toast({ message: `Couldn't delete ${prevRow?.name ?? 'item'}`, tone: 'error' })
      return { error }
    }
  }

  const clearChecked = async (userId) => {
    const checked = (snapshot() ?? []).filter(i => i.checked)
    await Promise.allSettled(checked.map(i => checkItem(i, userId)))
  }

  const markChecked = (id) => {
    setAll(prev => prev.map(i => (i.id === id ? { ...i, checked: true, checked_at: new Date().toISOString() } : i)))
  }

  const markUnchecked = (id) => {
    setAll(prev => prev.map(i => (i.id === id ? { ...i, checked: false, checked_at: null } : i)))
  }

  const reorderItems = async (orderedIds, userId) => {
    if (!householdId) return { error: 'No household' }
    await qc.cancelQueries({ queryKey: key })
    const snap = snapshot()
    const positions = new Map(orderedIds.map((id, idx) => [id, idx]))
    setAll(prev => byOrder(prev.map(i => (positions.has(i.id) ? { ...i, sort_order: positions.get(i.id) } : i))))

    if (isOffline()) {
      await queueWrite({ type: 'reorder', orderedIds, userId })
      return { error: null, queued: true }
    }

    try {
      await setGrocerySortOrder(supabase, orderedIds, userId)
      return { error: null }
    } catch (error) {
      // reorder is a single writer over the whole list; a snapshot is correct here
      if (snap) qc.setQueryData(key, snap)
      toast({ message: "Couldn't save the new order", tone: 'error' })
      return { error }
    }
  }

  return {
    items, loading: isPending,
    addItem, checkItem, uncheckItem, deleteItem, updateItem, clearChecked, markChecked, markUnchecked, reorderItems,
  }
}
