import { openDB } from 'idb'

const DB_NAME = 'caputo-home'
const DB_VERSION = 1

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Store for cached grocery items
      if (!db.objectStoreNames.contains('grocery_items')) {
        db.createObjectStore('grocery_items', { keyPath: 'id' })
      }
      // Store for offline write queue
      if (!db.objectStoreNames.contains('write_queue')) {
        const store = db.createObjectStore('write_queue', { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp')
      }
    },
  })
}

// Cache all grocery items locally
export async function cacheGroceryItems(items) {
  const db = await getDB()
  const tx = db.transaction('grocery_items', 'readwrite')
  const store = tx.objectStore('grocery_items')
  await store.clear()
  for (const item of items) {
    await store.put(item)
  }
  await tx.done
}

// Get all cached grocery items
export async function getCachedGroceryItems() {
  const db = await getDB()
  return db.getAll('grocery_items')
}

// Add a write operation to the queue
export async function queueWrite(operation) {
  const db = await getDB()
  await db.add('write_queue', {
    ...operation,
    timestamp: Date.now(),
  })
}

// Get all pending writes
export async function getPendingWrites() {
  const db = await getDB()
  return db.getAllFromIndex('write_queue', 'timestamp')
}

// Clear a write from the queue after successful sync
export async function clearWrite(id) {
  const db = await getDB()
  await db.delete('write_queue', id)
}

// Clear all pending writes
export async function clearAllWrites() {
  const db = await getDB()
  const tx = db.transaction('write_queue', 'readwrite')
  await tx.objectStore('write_queue').clear()
  await tx.done
}

// Get count of pending writes
export async function getPendingCount() {
  const db = await getDB()
  return db.count('write_queue')
}
