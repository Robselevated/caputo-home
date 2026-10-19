// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// A chainable Supabase stand-in: every call is recorded, and each table
// answers with whatever the test put in `tables`.
const calls = []
const tables = {}
const chain = (table) => {
  const rec = { table, ops: [] }
  calls.push(rec)
  const proxy = new Proxy({}, {
    get(_, op) {
      if (op === 'then') {
        const res = typeof tables[table] === 'function' ? tables[table](rec) : (tables[table] ?? { data: null, error: null })
        return (ok, bad) => Promise.resolve(res).then(ok, bad)
      }
      return (...args) => { rec.ops.push([op, ...args]); return proxy }
    },
  })
  return proxy
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (t) => chain(t) }) }))
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) } }))
vi.mock('./auth.js', () => ({ verifyAuth: vi.fn(async () => ({ id: 'rob', household_id: 'hh' })) }))
vi.mock('./rate-limit.js', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }))

const webpush = (await import('web-push')).default
const { checkRateLimit } = await import('./rate-limit.js')
process.env.VITE_VAPID_PUBLIC_KEY = 'pub'
process.env.VAPID_PRIVATE_KEY = 'priv'
const { handler } = await import('../send-push.js')

const post = (body) => handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) })
const opsOf = (table, op) => calls.filter(c => c.table === table && c.ops.some(([o]) => o === op))

beforeEach(() => {
  calls.length = 0
  for (const k of Object.keys(tables)) delete tables[k]
  vi.clearAllMocks()
  tables.users = (rec) => {
    if (rec.ops.some(([o]) => o === 'single') && rec.ops.some(([o, c]) => o === 'select' && c === 'household_id')) return { data: { household_id: 'hh' } }
    if (rec.ops.some(([o]) => o === 'single')) return { data: { name: 'Rob' } }
    if (rec.ops.some(([o]) => o === 'neq')) return { data: [{ id: 'chey', push_subscription: { endpoint: 'x' }, last_notified_at: null }] }
    return { data: null, error: null }
  }
  tables.grocery_notifications = (rec) => (rec.ops.some(([o]) => o === 'order') ? { data: [{ id: 'n1', action: 'added', item_name: 'Milk' }] } : { data: null, error: null })
})

describe('send-push', () => {
  it('rejects an unknown action and an empty item name', async () => {
    expect((await post({ household_id: 'hh', action: 'hacked', item_name: 'x' })).statusCode).toBe(400)
    expect((await post({ household_id: 'hh', action: 'added', item_name: '   ' })).statusCode).toBe(400)
  })

  it('refuses a household that is not the caller\'s', async () => {
    expect((await post({ household_id: 'other', action: 'added', item_name: 'Milk' })).statusCode).toBe(403)
  })

  it('records the sender from the token, not the body, and caps the item name', async () => {
    await post({ household_id: 'hh', changed_by_user_id: 'someone-else', action: 'added', item_name: 'M'.repeat(200) })
    const insert = opsOf('grocery_notifications', 'insert')[0].ops.find(([o]) => o === 'insert')[1]
    expect(insert.changed_by).toBe('rob')
    expect(insert.item_name).toHaveLength(80)
  })

  it('stops at the rate limit', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false })
    expect((await post({ household_id: 'hh', action: 'added', item_name: 'Milk' })).statusCode).toBe(429)
  })

  it('sends one push and clears only the rows it read', async () => {
    const res = await post({ household_id: 'hh', action: 'added', item_name: 'Milk' })
    expect(res.statusCode).toBe(200)
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    expect(JSON.parse(webpush.sendNotification.mock.calls[0][1]).body).toBe('Rob added Milk')
    const cleared = opsOf('grocery_notifications', 'delete').find(c => c.ops.some(([o]) => o === 'in'))
    expect(cleared.ops.find(([o]) => o === 'in')).toEqual(['in', 'id', ['n1']])
  })
})
