import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { queueWrite, clearWrite, getPendingWrites, onQueueChange, getPendingCount } from './db'

describe('write queue change events', () => {
  it('notifies listeners with the new pending count on queue and clear', async () => {
    const seen = []
    const off = onQueueChange((n) => seen.push(n))
    await queueWrite({ type: 'delete', itemId: 'x' })
    const [w] = await getPendingWrites()
    await clearWrite(w.id)
    off()
    await queueWrite({ type: 'delete', itemId: 'y' })
    expect(seen).toEqual([1, 0])
    expect(await getPendingCount()).toBe(1)
  })
})
