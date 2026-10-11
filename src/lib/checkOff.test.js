import { describe, it, expect, vi } from 'vitest'
import { checkOffGroceryItem } from './checkOff'

// Minimal fake of the supabase client: `from(table)` returns a chainable
// builder that resolves to the configured result for that table.
function makeClient({ rpc, tables = {} }) {
  const calls = { rpc: [], from: [] }
  const builderFor = (table) => {
    const result = tables[table] ?? { data: null, error: null }
    const b = {}
    const chain = () => b
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'ilike', 'limit', 'maybeSingle', 'order']) {
      b[m] = vi.fn(chain)
    }
    b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    return b
  }
  return {
    calls,
    rpc: vi.fn(async (name, args) => { calls.rpc.push([name, args]); return rpc }),
    from: vi.fn((table) => { calls.from.push(table); return builderFor(table) }),
  }
}

const item = { id: 'g1', name: 'Rice', qty: 2, unit: 'bags', store: 'Costco', notes: null }
const args = { item, householdId: 'hh', userId: 'u1' }

describe('checkOffGroceryItem', () => {
  it('uses the single RPC when it exists and never touches tables directly', async () => {
    const client = makeClient({ rpc: { data: { status: 'ok', inventory: { merged: true } }, error: null } })
    const res = await checkOffGroceryItem(client, args)
    expect(res.error).toBeNull()
    expect(res.via).toBe('rpc')
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.calls.rpc[0][0]).toBe('check_off_grocery_item')
    expect(client.calls.rpc[0][1]).toMatchObject({ p_item_id: 'g1' })
    expect(client.calls.rpc[0][1].p_location).toBeTruthy()
    expect(client.calls.rpc[0][1].p_category).toBeTruthy()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('falls back to the legacy multi-step path when the function is missing (PGRST202)', async () => {
    const client = makeClient({ rpc: { data: null, error: { code: 'PGRST202', message: 'function not found' } } })
    const res = await checkOffGroceryItem(client, args)
    expect(res.error).toBeNull()
    expect(res.via).toBe('legacy')
    expect(client.calls.from).toEqual(
      expect.arrayContaining(['recently_bought', 'item_history', 'inventory_items', 'grocery_items'])
    )
  })

  it('returns any other RPC error without running the legacy path', async () => {
    const client = makeClient({ rpc: { data: null, error: { code: '42501', message: 'permission denied' } } })
    const res = await checkOffGroceryItem(client, args)
    expect(res.error).toMatchObject({ code: '42501' })
    expect(client.from).not.toHaveBeenCalled()
  })
})
