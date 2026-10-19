// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { verifyAuth } from './auth.js'

const fakeCreate = ({ user = { id: 'u1' }, authError = null, profile = { household_id: 'h1' } } = {}) => () => ({
  auth: { getUser: async () => ({ data: { user: authError ? null : user }, error: authError }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
})
const ev = (auth) => ({ headers: auth ? { authorization: `Bearer ${auth}` } : {} })

describe('verifyAuth', () => {
  it('refuses a request with no token', async () => {
    expect(await verifyAuth(ev(null), { create: fakeCreate() })).toBeNull()
  })
  it('refuses a token Supabase does not accept', async () => {
    expect(await verifyAuth(ev('t'), { create: fakeCreate({ authError: { message: 'bad jwt' } }) })).toBeNull()
  })
  it('refuses a real login that belongs to no household', async () => {
    expect(await verifyAuth(ev('t'), { create: fakeCreate({ profile: null }) })).toBeNull()
    expect(await verifyAuth(ev('t'), { create: fakeCreate({ profile: { household_id: null } }) })).toBeNull()
  })
  it('accepts a household member and carries the household id', async () => {
    expect(await verifyAuth(ev('t'), { create: fakeCreate() })).toMatchObject({ id: 'u1', household_id: 'h1' })
  })
})
