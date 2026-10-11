import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { createIdbStorage, createQueryPersister } from './persister'

describe('createIdbStorage', () => {
  it('round-trips a string value and removes it', async () => {
    const storage = createIdbStorage({ dbName: 'test-rq-1' })
    expect(await storage.getItem('k')).toBeNull()
    await storage.setItem('k', '{"hello":1}')
    expect(await storage.getItem('k')).toBe('{"hello":1}')
    await storage.removeItem('k')
    expect(await storage.getItem('k')).toBeNull()
  })

  it('uses its own database, never the offline-queue database "caputo-home"', async () => {
    const storage = createIdbStorage()
    await storage.setItem('probe', '1')
    const names = (await indexedDB.databases()).map(d => d.name)
    expect(names).toContain('caputo-rq')
    expect(names).not.toContain('caputo-home')
  })

  it('degrades to a no-op when IndexedDB throws instead of breaking the app', async () => {
    const storage = createIdbStorage({ dbName: 'broken', open: async () => { throw new Error('blocked') } })
    expect(await storage.getItem('k')).toBeNull()
    await expect(storage.setItem('k', 'v')).resolves.toBeUndefined()
  })
})

describe('createQueryPersister', () => {
  it('persists and restores a client snapshot under the versioned key', async () => {
    const storage = createIdbStorage({ dbName: 'test-rq-2' })
    const persister = createQueryPersister({ storage, throttleTime: 0 })
    const snapshot = { timestamp: Date.now(), buster: 'v1', clientState: { mutations: [], queries: [{ queryKey: ['x'], queryHash: '["x"]', state: { data: 1, status: 'success' } }] } }
    await persister.persistClient(snapshot)
    const restored = await persister.restoreClient()
    expect(restored.clientState.queries[0].state.data).toBe(1)
    expect(await storage.getItem('caputo-rq-v1')).toContain('"queryHash"')
    await persister.removeClient()
    expect(await persister.restoreClient()).toBeUndefined()
  })
})
