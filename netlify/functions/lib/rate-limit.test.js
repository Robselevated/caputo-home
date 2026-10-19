// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// A fake api_usage table plus a fake reserve_api_usage RPC (or a missing one).
const db = { rows: [], rpc: 'ok', rpcCalls: 0, nextId: 1 }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: vi.fn(async (name, { p_user, p_action, p_max }) => {
      db.rpcCalls++
      if (db.rpc === 'missing') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
      if (db.rpc === 'broken') return { data: null, error: { code: '57014', message: 'canceling statement' } }
      const used = db.rows.filter(r => r.user_id === p_user && r.action === p_action).length
      if (used >= p_max) return { data: [{ allowed: false, used, usage_id: null }], error: null }
      const id = `row${db.nextId++}`
      db.rows.push({ id, user_id: p_user, action: p_action })
      return { data: [{ allowed: true, used, usage_id: id }], error: null }
    }),
    from: () => ({
      insert: async (row) => { db.rows.push({ id: `row${db.nextId++}`, ...row }); return { error: null } },
      delete: () => ({ eq: async (_col, id) => { db.rows = db.rows.filter(r => r.id !== id); return { error: null } } }),
      select: () => {
        const filters = {}
        const q = {
          eq: (col, val) => { filters[col] = val; return q },
          gte: async () => ({ count: db.rows.filter(r => r.user_id === filters.user_id && r.action === filters.action).length, error: null }),
        }
        return q
      },
    }),
  }),
}))

const { checkRateLimit } = await import('./rate-limit.js')

beforeEach(() => {
  db.rows = []
  db.rpc = 'ok'
  db.rpcCalls = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('checkRateLimit with reserve_api_usage', () => {
  it('reserves a row per allowed call and refuses at the limit', async () => {
    const a = await checkRateLimit('u1', 'scan', 2)
    const b = await checkRateLimit('u1', 'scan', 2)
    const c = await checkRateLimit('u1', 'scan', 2)
    expect([a.allowed, b.allowed, c.allowed]).toEqual([true, true, false])
    expect([a.remaining, b.remaining, c.remaining]).toEqual([1, 0, 0])
    expect(db.rows).toHaveLength(2)
  })

  it('counts each user and action separately', async () => {
    await checkRateLimit('u1', 'scan', 1)
    expect((await checkRateLimit('u2', 'scan', 1)).allowed).toBe(true)
    expect((await checkRateLimit('u1', 'push', 1)).allowed).toBe(true)
  })

  it('reserve:false holds the slot while working and gives it back on failure', async () => {
    const r = await checkRateLimit('u1', 'parse', 1, { reserve: false })
    expect(r.allowed).toBe(true)
    expect(db.rows).toHaveLength(1)
    // The in-flight request already counts, so a parallel one is refused.
    expect((await checkRateLimit('u1', 'parse', 1, { reserve: false })).allowed).toBe(false)
    await r.settle(false)
    expect(db.rows).toHaveLength(0)
    expect((await checkRateLimit('u1', 'parse', 1, { reserve: false })).allowed).toBe(true)
  })

  it('reserve:false keeps the row on success', async () => {
    const r = await checkRateLimit('u1', 'parse', 5, { reserve: false })
    await r.settle(true)
    expect(db.rows).toHaveLength(1)
  })

  it('settle is harmless on a reserving call and on a refusal', async () => {
    const r = await checkRateLimit('u1', 'scan', 1)
    await r.settle(false)
    expect(db.rows).toHaveLength(1)
    const refused = await checkRateLimit('u1', 'scan', 1)
    await refused.settle(false)
    expect(db.rows).toHaveLength(1)
  })
})

describe('checkRateLimit before the SQL is run', () => {
  it('falls back to count-then-insert when the RPC is missing, without a warning', async () => {
    db.rpc = 'missing'
    const a = await checkRateLimit('u1', 'scan', 1)
    const b = await checkRateLimit('u1', 'scan', 1)
    expect([a.allowed, b.allowed]).toEqual([true, false])
    expect(db.rows).toHaveLength(1)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('reserve:false on the fallback counts only on success', async () => {
    db.rpc = 'missing'
    const failed = await checkRateLimit('u1', 'parse', 5, { reserve: false })
    await failed.settle(false)
    expect(db.rows).toHaveLength(0)
    const ok = await checkRateLimit('u1', 'parse', 5, { reserve: false })
    await ok.settle(true)
    expect(db.rows).toHaveLength(1)
  })

  it('falls back with a warning on any other RPC error', async () => {
    db.rpc = 'broken'
    expect((await checkRateLimit('u1', 'scan', 1)).allowed).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })
})
