import { openDB } from 'idb'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

// Persists the TanStack Query cache so every tab (and a cold open) paints from
// the last known data instantly. Lives in its OWN IndexedDB database: bumping
// the offline-queue database `caputo-home` (src/lib/db.js) would make a
// rolled-back build fail to open it and silently disable the write queue.
const DEFAULT_DB = 'caputo-rq'
const STORE = 'kv'

export const PERSIST_KEY = 'caputo-rq-v1'
export const PERSIST_BUSTER = 'v1' // bump when a cached row shape changes
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000

export function createIdbStorage({ dbName = DEFAULT_DB, open } = {}) {
  let dbPromise = null

  const getDB = () => {
    if (!dbPromise) {
      const opener = open
        ? open()
        : openDB(dbName, 1, {
            upgrade(db) {
              if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
            },
          })
      dbPromise = Promise.resolve(opener).catch((err) => {
        console.warn('Query cache IndexedDB unavailable:', err?.message ?? err)
        return null
      })
    }
    return dbPromise
  }

  return {
    async getItem(key) {
      try {
        const db = await getDB()
        if (!db) return null
        const value = await db.get(STORE, key)
        return value ?? null
      } catch {
        return null
      }
    },
    async setItem(key, value) {
      try {
        const db = await getDB()
        if (!db) return
        await db.put(STORE, value, key)
      } catch (err) {
        console.warn('Query cache write failed:', err?.message ?? err)
      }
    },
    async removeItem(key) {
      try {
        const db = await getDB()
        if (!db) return
        await db.delete(STORE, key)
      } catch {
        // best-effort
      }
    },
  }
}

export function createQueryPersister({ storage = createIdbStorage(), throttleTime = 1000, key = PERSIST_KEY } = {}) {
  return createAsyncStoragePersister({ storage, key, throttleTime })
}
