import { openDB } from 'idb'

const DB_NAME = 'caputo-home'
const DB_VERSION = 1

let dbInstance = null
let dbFailed = false

async function getDB() {
  if (dbFailed) return null
  if (dbInstance) return dbInstance

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
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

export async function cacheGroceryItems(items) {
  const db = await getDB()
  if (!db) return
  try {
    const tx = db.transaction('grocery_items', 'readwrite')
    const store = tx.objectStore('grocery_items')
    await store.clear()
    for (const item of items) {
      await store.put(item)
    }
    await tx.done
  } catch (err) {
    console.warn('Cache write failed:', err.message)
  }
}

export async function getCachedGroceryItems() {
  const db = await getDB()
  if (!db) return []
  try {
    return await db.getAll('grocery_items')
  } catch {
    return []
  }
}

export async function queueWrite(operation) {
  const db = await getDB()
  if (!db) return
  try {
    await db.add('write_queue', {
      ...operation,
      timestamp: Date.now(),
    })
  } catch (err) {
    console.warn('Queue write failed:', err.message)
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
