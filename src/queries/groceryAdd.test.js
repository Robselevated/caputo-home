import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

vi.mock('../lib/db', () => ({ queueWrite: vi.fn(async () => true) }))
vi.mock('../lib/offlineToasts', () => ({ toastNotQueued: vi.fn() }))

import { queueWrite } from '../lib/db'
import { placeAtEnd, addGroceryRows } from './groceryAdd'
import { keys } from './keys'

const client = (result) => {
  const insert = vi.fn(() => ({ select: async () => result }))
  return { from: vi.fn(() => ({ insert })), insert }
}

beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }) })

describe('placeAtEnd', () => {
  it('numbers new rows after the highest sort_order in their own store', () => {
    const current = [{ store: null, sort_order: 3 }, { store: 'Costco', sort_order: 9 }]
    const out = placeAtEnd([{ name: 'a' }, { name: 'b', store: 'Costco' }, { name: 'c' }, { name: 'd', store: 'Target' }], current)
    expect(out.map(r => r.sort_order)).toEqual([4, 10, 5, 1])
  })
})

describe('addGroceryRows', () => {
  it('adds optimistically, inserts once, and keeps the saved rows', async () => {
    const qc = new QueryClient()
    qc.setQueryData(keys.grocery('hh'), [])
    const c = client({ data: [{ id: 'srv', name: 'milk', sort_order: 1 }], error: null })
    const res = await addGroceryRows(qc, c, 'hh', [{ id: 'srv', name: 'milk' }])
    expect(res.error).toBeNull()
    expect(c.insert).toHaveBeenCalledTimes(1)
    expect(qc.getQueryData(keys.grocery('hh')).map(r => r.name)).toEqual(['milk'])
  })
  it('rolls the optimistic rows back when the insert fails', async () => {
    const qc = new QueryClient()
    qc.setQueryData(keys.grocery('hh'), [{ id: 'keep', name: 'eggs' }])
    const res = await addGroceryRows(qc, client({ data: null, error: { message: 'denied' } }), 'hh', [{ name: 'milk' }])
    expect(res.error).toBeTruthy()
    expect(qc.getQueryData(keys.grocery('hh')).map(r => r.name)).toEqual(['eggs'])
  })
  it('queues each row when offline instead of calling the server', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const qc = new QueryClient()
    const c = client({ data: null, error: null })
    const res = await addGroceryRows(qc, c, 'hh', [{ name: 'milk' }, { name: 'bread' }])
    expect(res).toMatchObject({ error: null, queued: true })
    expect(queueWrite).toHaveBeenCalledTimes(2)
    expect(c.from).not.toHaveBeenCalled()
  })
})
