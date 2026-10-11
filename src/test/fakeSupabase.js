import { vi } from 'vitest'

// A small in-memory stand-in for the supabase-js client used by hook tests.
// - from(table) returns a chainable builder that records every call and
//   resolves (it is thenable) to the result configured for `${table}.${verb}`.
// - rpc(name) resolves to the result configured for `rpc.${name}`.
// - channel() records handlers so tests can emit() realtime payloads.
const VERBS = ['select', 'insert', 'update', 'upsert', 'delete']
const CHAIN = [...VERBS, 'eq', 'neq', 'in', 'ilike', 'order', 'limit', 'single', 'maybeSingle', 'gte', 'lte']

export function createFakeSupabase() {
  const results = new Map()
  const fake = {
    calls: [],
    channels: [],
    setResult(table, verb, result) {
      results.set(`${table}.${verb}`, result)
    },
    reset() {
      results.clear()
      fake.calls.length = 0
      fake.channels.length = 0
    },
    callsFor(table, verb) {
      return fake.calls.filter(c => c.table === table && (!verb || c.verb === verb))
    },
    emit(payload) {
      for (const ch of fake.channels) for (const h of ch.handlers) h(payload)
    },
    from: vi.fn((table) => makeBuilder(table)),
    rpc: vi.fn(async (name, args) => {
      fake.calls.push({ table: 'rpc', verb: name, chain: [['rpc', name, args]], args })
      const res = results.get(`rpc.${name}`)
      return typeof res === 'function' ? res(args) : (res ?? { data: null, error: null })
    }),
    channel: vi.fn((name) => {
      const ch = {
        name,
        handlers: [],
        on: vi.fn((event, filter, handler) => { ch.handlers.push(handler); return ch }),
        subscribe: vi.fn(() => ch),
      }
      fake.channels.push(ch)
      return ch
    }),
    removeChannel: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) },
  }

  function makeBuilder(table) {
    const record = { table, verb: null, chain: [] }
    fake.calls.push(record)
    const b = {}
    for (const m of CHAIN) {
      b[m] = vi.fn((...args) => {
        record.chain.push([m, ...args])
        if (!record.verb && VERBS.includes(m)) record.verb = m
        return b
      })
    }
    b.has = (method, ...args) =>
      record.chain.some(([m, ...a]) => m === method && args.every((x, i) => JSON.stringify(a[i]) === JSON.stringify(x)))
    b.then = (resolve, reject) => {
      const res = results.get(`${table}.${record.verb}`)
      const value = typeof res === 'function' ? res(record) : (res ?? { data: null, error: null })
      return Promise.resolve(value).then(resolve, reject)
    }
    record.builder = b
    return b
  }

  return fake
}

export function chainHas(record, method, ...args) {
  return record.chain.some(([m, ...a]) => m === method && args.every((x, i) => JSON.stringify(a[i]) === JSON.stringify(x)))
}
