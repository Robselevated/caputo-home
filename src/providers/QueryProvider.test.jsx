import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useQuery, QueryClient } from '@tanstack/react-query'
import { createIdbStorage, createQueryPersister, PERSIST_BUSTER } from '../lib/persister'
import { QueryProvider, shouldPersistQuery } from './QueryProvider'

function Probe() {
  const { data, isPending } = useQuery({ queryKey: ['grocery_items', 'hh'], queryFn: () => Promise.resolve(['fresh']), enabled: false })
  return <div>{isPending ? 'pending' : JSON.stringify(data)}</div>
}

describe('QueryProvider', () => {
  it('restores the last session\'s cache from IndexedDB so the first paint has data', async () => {
    const storage = createIdbStorage({ dbName: 'qp-test-1' })
    const persister = createQueryPersister({ storage, throttleTime: 0 })
    await persister.persistClient({
      timestamp: Date.now(),
      buster: PERSIST_BUSTER,
      clientState: {
        mutations: [],
        queries: [{
          queryKey: ['grocery_items', 'hh'],
          queryHash: JSON.stringify(['grocery_items', 'hh']),
          state: { data: ['from-disk'], dataUpdateCount: 1, dataUpdatedAt: Date.now(), error: null, errorUpdateCount: 0, errorUpdatedAt: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, isInvalidated: false, status: 'success', fetchStatus: 'idle' },
        }],
      },
    })
    render(<QueryProvider client={new QueryClient()} persister={persister}><Probe /></QueryProvider>)
    await waitFor(() => expect(screen.getByText('["from-disk"]')).toBeInTheDocument())
  })

  it('ignores a snapshot written by an older cache version (buster mismatch)', async () => {
    const storage = createIdbStorage({ dbName: 'qp-test-2' })
    const persister = createQueryPersister({ storage, throttleTime: 0 })
    await persister.persistClient({
      timestamp: Date.now(),
      buster: 'v0-old',
      clientState: { mutations: [], queries: [{ queryKey: ['grocery_items', 'hh'], queryHash: JSON.stringify(['grocery_items', 'hh']), state: { data: ['stale-shape'], dataUpdateCount: 1, dataUpdatedAt: Date.now(), error: null, errorUpdateCount: 0, errorUpdatedAt: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, isInvalidated: false, status: 'success', fetchStatus: 'idle' } }] },
    })
    render(<QueryProvider client={new QueryClient()} persister={persister}><Probe /></QueryProvider>)
    await new Promise(r => setTimeout(r, 50))
    expect(screen.getByText('pending')).toBeInTheDocument()
  })
})

describe('shouldPersistQuery', () => {
  it('keeps any query that still has data, even after a failed refetch, and drops empty pending ones', () => {
    expect(shouldPersistQuery({ state: { status: 'success', data: [1] } })).toBe(true)
    expect(shouldPersistQuery({ state: { status: 'error', data: [1], error: new Error('timeout') } })).toBe(true)
    expect(shouldPersistQuery({ state: { status: 'pending', data: undefined } })).toBe(false)
    expect(shouldPersistQuery({ state: { status: 'error', data: undefined } })).toBe(false)
  })
})
