import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getPendingWrites, clearWrite, getPendingCount, incrementWriteAttempts, onQueueChange } from '../lib/db'
import { checkOffGroceryItem } from '../lib/checkOff'
import { queryClient } from '../lib/queryClient'
import { keys } from '../queries/keys'
import { toastWriteDropped } from '../lib/offlineToasts'

const MAX_SYNC_ATTEMPTS = 5
// After a pass leaves writes behind (a transient 5xx, a cold radio), try again
// on a backoff instead of waiting for the next online event or queue change,
// which may never come while the phone stays connected.
const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 60000

// supabase-js resolves with { error } instead of throwing. Turn that into a
// throw so a failed replay is retried (and eventually dropped) instead of being
// cleared from the queue as if it had succeeded.
function ok(res) {
  if (res?.error) throw res.error
  return res
}

async function mergeInventory(data) {
  const res = await supabase.rpc('merge_inventory_item', {
    p_household_id: data.household_id,
    p_name: data.name,
    p_qty: data.qty ?? 1,
    p_unit: data.unit ?? null,
    p_location: data.location,
    p_category: data.category,
    p_subcategory: data.subcategory ?? null,
    p_notes: data.notes ?? null,
  })
  if (res?.error?.code === 'PGRST202') {
    // function not deployed yet: plain insert
    return ok(await supabase.from('inventory_items').insert(data))
  }
  return ok(res)
}

async function replay(write) {
  switch (write.type) {
    case 'insert':
      return ok(await supabase.from('grocery_items').insert(write.data))
    case 'update':
      return ok(await supabase.from('grocery_items').update(write.changes).eq('id', write.itemId))
    case 'delete':
      return ok(await supabase.from('grocery_items').delete().eq('id', write.itemId))
    case 'check': {
      const { item, householdId, userId } = write
      return ok(await checkOffGroceryItem(supabase, { item, householdId, userId }))
    }
    case 'reorder': {
      const { orderedIds, userId } = write
      const results = await Promise.all(orderedIds.map((id, index) =>
        supabase.from('grocery_items').update({
          sort_order: index,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }).eq('id', id)
      ))
      results.forEach(ok)
      return results
    }
    case 'inventory_add':
    case 'inventory_merge':
      return mergeInventory(write.data)
    case 'inventory_delete':
      return ok(await supabase.from('inventory_items').delete().eq('id', write.itemId).select('id'))
    case 'inventory_update':
      return ok(await supabase.from('inventory_items').update(write.changes).eq('id', write.itemId).select('id'))
    default:
      return null
  }
}

// The ONE offline-sync instance lives in Layout. It replays queued writes when
// connectivity returns and refreshes the caches those writes touched.
export function useOfflineSync(householdId) {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)
  const retryRef = useRef({ timer: null, backoff: 0 })
  const syncNowRef = useRef(null)

  useEffect(() => () => {
    if (retryRef.current.timer) clearTimeout(retryRef.current.timer)
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Pending count: one read on mount, then push updates from the queue.
  useEffect(() => {
    let alive = true
    getPendingCount().then((n) => { if (alive) setPendingCount(n) })
    const off = onQueueChange((n) => { if (alive) setPendingCount(n) })
    return () => {
      alive = false
      off()
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    syncingRef.current = true
    setSyncing(true)
    try {
      // TanStack refetches on the same `online` event, before this effect runs.
      // Cancel those (revert keeps the optimistic cache) so a pre-replay server
      // response cannot flash the offline edits away; the invalidate below is
      // the real catch-up.
      if (householdId) {
        await Promise.all([keys.grocery(householdId), keys.inventory(householdId), keys.recentlyBought(householdId)]
          .map(queryKey => queryClient.cancelQueries({ queryKey })))
      }
      const writes = await getPendingWrites()
      for (const write of writes) {
        try {
          await replay(write)
          await clearWrite(write.id)
        } catch (err) {
          console.error('Sync error for write:', write.id, err)
          const attempts = await incrementWriteAttempts(write.id)
          if (attempts >= MAX_SYNC_ATTEMPTS) {
            console.error(`Dropping write after ${MAX_SYNC_ATTEMPTS} failed attempts:`, write)
            await clearWrite(write.id)
            toastWriteDropped(write)
          }
        }
      }
      const remaining = await getPendingCount()
      setPendingCount(remaining)
      const retry = retryRef.current
      if (retry.timer) clearTimeout(retry.timer)
      retry.timer = null
      if (remaining > 0) {
        const delay = Math.min(RETRY_BASE_MS * 2 ** retry.backoff, RETRY_MAX_MS)
        retry.backoff += 1
        retry.timer = setTimeout(() => {
          retry.timer = null
          syncNowRef.current?.()
        }, delay)
      } else {
        retry.backoff = 0
      }
      if (householdId) {
        queryClient.invalidateQueries({ queryKey: keys.grocery(householdId) })
        queryClient.invalidateQueries({ queryKey: keys.inventory(householdId) })
        queryClient.invalidateQueries({ queryKey: keys.recentlyBought(householdId) })
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [householdId])
  syncNowRef.current = syncNow

  // Auto-sync when back online with work queued.
  useEffect(() => {
    if (isOnline && pendingCount > 0) syncNow()
  }, [isOnline, pendingCount, syncNow])

  return { isOnline, pendingCount, syncing, syncNow }
}
