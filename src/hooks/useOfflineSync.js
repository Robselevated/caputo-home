import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGroceryItems, getCachedGroceryItems, queueWrite, getPendingWrites, clearWrite, getPendingCount } from '../lib/db'

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

  // Check pending count periodically
  useEffect(() => {
    const check = async () => {
      const count = await getPendingCount()
      setPendingCount(count)
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
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
              const { id: _, timestamp: __, type: ___, ...itemData } = write
              await supabase.from('grocery_items').insert(itemData)
              break
            }
            case 'update': {
              const { itemId, changes } = write
              await supabase.from('grocery_items').update(changes).eq('id', itemId)
              break
            }
            case 'delete': {
              await supabase.from('grocery_items').delete().eq('id', write.itemId)
              break
            }
          }
          await clearWrite(write.id)
        } catch (err) {
          console.error('Sync error for write:', write.id, err)
          // Continue with other writes
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
