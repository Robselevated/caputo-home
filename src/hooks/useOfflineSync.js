import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGroceryItems, getCachedGroceryItems, queueWrite, getPendingWrites, clearWrite, getPendingCount, incrementWriteAttempts } from '../lib/db'
import { checkOffGroceryItem } from '../lib/checkOff'

const MAX_SYNC_ATTEMPTS = 5

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

export function useOfflineSync(householdId) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  // Listen for online/offline events
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

  // Check pending count periodically while the app is visible. Pausing the poll
  // when backgrounded avoids needless wakeups / battery drain — the resume
  // handler re-checks on return anyway.
  useEffect(() => {
    let interval = null
    const check = async () => {
      const count = await getPendingCount()
      setPendingCount(count)
    }
    const start = () => {
      if (interval) return
      check()
      interval = setInterval(check, 5000)
    }
    const stop = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }
    if (typeof document === 'undefined' || document.visibilityState === 'visible') start()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    return () => {
      stop()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow()
    }
  }, [isOnline, pendingCount])

  // Cache items from Supabase to IndexedDB
  const cacheFromSupabase = useCallback(async (items) => {
    await cacheGroceryItems(items)
  }, [])

  // Get cached items when offline
  const getCachedItems = useCallback(async () => {
    return getCachedGroceryItems()
  }, [])

  // Queue an offline write
  const queueOfflineWrite = useCallback(async (operation) => {
    await queueWrite(operation)
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  // Replay all pending writes to Supabase
  const syncNow = useCallback(async () => {
    if (syncing || !isOnline) return
    setSyncing(true)

    try {
      const writes = await getPendingWrites()

      for (const write of writes) {
        try {
          switch (write.type) {
            case 'insert': {
              ok(await supabase.from('grocery_items').insert(write.data))
              break
            }
            case 'update': {
              ok(await supabase.from('grocery_items').update(write.changes).eq('id', write.itemId))
              break
            }
            case 'delete': {
              ok(await supabase.from('grocery_items').delete().eq('id', write.itemId))
              break
            }
            case 'check': {
              const { item, householdId, userId } = write
              ok(await checkOffGroceryItem(supabase, { item, householdId, userId }))
              break
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
              break
            }
            case 'inventory_add':
            case 'inventory_merge': {
              await mergeInventory(write.data)
              break
            }
            case 'inventory_delete': {
              ok(await supabase.from('inventory_items').delete().eq('id', write.itemId).select('id'))
              break
            }
            case 'inventory_update': {
              ok(await supabase.from('inventory_items').update(write.changes).eq('id', write.itemId).select('id'))
              break
            }
          }
          await clearWrite(write.id)
        } catch (err) {
          console.error('Sync error for write:', write.id, err)
          const attempts = await incrementWriteAttempts(write.id)
          if (attempts >= MAX_SYNC_ATTEMPTS) {
            console.error(`Dropping write after ${MAX_SYNC_ATTEMPTS} failed attempts:`, write)
            await clearWrite(write.id)
          }
        }
      }

      const count = await getPendingCount()
      setPendingCount(count)
    } finally {
      setSyncing(false)
    }
  }, [syncing, isOnline])

  return {
    isOnline,
    pendingCount,
    syncing,
    cacheFromSupabase,
    getCachedItems,
    queueOfflineWrite,
    syncNow,
  }
}
