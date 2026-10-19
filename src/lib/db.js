import { openDB } from 'idb'

const DB_NAME = 'caputo-home'
const DB_VERSION = 1

let dbInstance = null
let dbFailed = false

// Listeners get the new pending count whenever the write queue changes, so
// useOfflineSync can react instead of polling IndexedDB every few seconds.
const queueListeners = new Set()

export function onQueueChange(listener) {
  queueListeners.add(listener)
  return () => queueListeners.delete(listener)
}

async function notifyQueueChange() {
  if (queueListeners.size === 0) return
  const count = await getPendingCount()
  for (const listener of queueListeners) {
    try {
      listener(count)
    } catch {
      // one bad listener must not break the others
    }
  }
}

async function getDB() {
  if (dbFailed) return null
  if (dbInstance) return dbInstance

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Unused since the query cache took over; kept so the schema never needs a version bump.
        if (!db.objectStoreNames.contains('grocery_items')) {
          db.createObjectStore('grocery_items', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('write_queue')) {
          const store = db.createObjectStore('write_queue', { keyPath: 'id', autoIncrement: true })
          store.createIndex('timestamp', 'timestamp')
        }
      },
    })
    return dbInstance
  } catch (err) {
    console.warn('IndexedDB unavailable:', err.message)
    dbFailed = true
    return null
  }
}

// Resolves true when the write is safely queued, false when it is not (no
// IndexedDB, e.g. private browsing, or the add failed). Callers report
// `queued: false` so a change that will never sync is not shown as pending.
export async function queueWrite(operation) {
  const db = await getDB()
  if (!db) return false
  try {
    await db.add('write_queue', {
      ...operation,
      timestamp: Date.now(),
    })
    await notifyQueueChange()
    return true
  } catch (err) {
    console.warn('Queue write failed:', err.message)
    return false
  }
}

export async function getPendingWrites() {
  const db = await getDB()
  if (!db) return []
  try {
    return await db.getAllFromIndex('write_queue', 'timestamp')
  } catch {
    return []
  }
}

export async function incrementWriteAttempts(id) {
  const db = await getDB()
  if (!db) return 0
  try {
    const write = await db.get('write_queue', id)
    if (!write) return 0
    const next = (write.attempts || 0) + 1
    await db.put('write_queue', { ...write, attempts: next })
    return next
  } catch (err) {
    console.warn('Increment attempts failed:', err.message)
    return 0
  }
}

export async function clearWrite(id) {
  const db = await getDB()
  if (!db) return
  try {
    await db.delete('write_queue', id)
    await notifyQueueChange()
  } catch (err) {
    console.warn('Clear write failed:', err.message)
  }
}

export async function clearAllWrites() {
  const db = await getDB()
  if (!db) return
  try {
    const tx = db.transaction('write_queue', 'readwrite')
    await tx.objectStore('write_queue').clear()
    await tx.done
    await notifyQueueChange()
  } catch (err) {
    console.warn('Clear all writes failed:', err.message)
  }
}

export async function getPendingCount() {
  const db = await getDB()
  if (!db) return 0
  try {
    return await db.count('write_queue')
  } catch {
    return 0
  }
}
