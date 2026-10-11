import { describe, it, expect } from 'vitest'
import { upsertById, removeById, applyChange, CLIENT_FIELDS } from './realtimeCache'

const a = { id: 'a', name: 'Rice', qty: 1, checked: false }
const b = { id: 'b', name: 'Beans', qty: 2, checked: false }
const rows = [a, b]

describe('upsertById', () => {
  it('replaces an existing row by id without duplicating it', () => {
    const next = upsertById(rows, { id: 'a', qty: 5 })
    expect(next.filter(r => r.id === 'a')).toHaveLength(1)
    expect(next.find(r => r.id === 'a')).toEqual({ id: 'a', name: 'Rice', qty: 5, checked: false })
  })

  it('appends a new row', () => {
    const next = upsertById(rows, { id: 'c', name: 'Apples' })
    expect(next.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps listed client-only fields from the local row when an echo arrives', () => {
    const local = [{ ...a, checked: true, checked_at: 't1' }, b]
    const next = upsertById(local, { id: 'a', qty: 9, checked: false, checked_at: null }, { preserve: CLIENT_FIELDS })
    expect(next.find(r => r.id === 'a')).toMatchObject({ qty: 9, checked: true, checked_at: 't1' })
  })

  it('returns the same array when nothing is given', () => {
    expect(upsertById(rows, null)).toBe(rows)
    expect(upsertById(rows, {})).toBe(rows)
  })
})

describe('removeById', () => {
  it('removes a row and returns the same array when the id is absent', () => {
    expect(removeById(rows, 'a').map(r => r.id)).toEqual(['b'])
    expect(removeById(rows, 'zzz')).toBe(rows)
  })
})

describe('applyChange', () => {
  it('DELETE keys on old.id only', () => {
    const next = applyChange(rows, { eventType: 'DELETE', old: { id: 'b' }, new: {} })
    expect(next.map(r => r.id)).toEqual(['a'])
  })

  it('INSERT appends and UPDATE merges', () => {
    let next = applyChange(rows, { eventType: 'INSERT', old: {}, new: { id: 'c', name: 'Apples' } })
    expect(next.map(r => r.id)).toEqual(['a', 'b', 'c'])
    next = applyChange(next, { eventType: 'UPDATE', old: { id: 'c' }, new: { id: 'c', qty: 3 } })
    expect(next.find(r => r.id === 'c')).toMatchObject({ name: 'Apples', qty: 3 })
  })

  it('a row that no longer passes the filter is removed (moved to another location)', () => {
    const pantryOnly = (row) => row.location === 'pantry'
    const local = [{ id: 'a', location: 'pantry' }]
    const next = applyChange(local, { eventType: 'UPDATE', old: { id: 'a' }, new: { id: 'a', location: 'fridge' } }, { filter: pantryOnly })
    expect(next).toEqual([])
  })

  it('an INSERT that fails the filter is ignored', () => {
    const pantryOnly = (row) => row.location === 'pantry'
    const next = applyChange(rows, { eventType: 'INSERT', old: {}, new: { id: 'z', location: 'fridge' } }, { filter: pantryOnly })
    expect(next).toBe(rows)
  })

  it('applies a sort after inserts and updates when given', () => {
    const byName = (xs) => [...xs].sort((x, y) => x.name.localeCompare(y.name))
    const next = applyChange(rows, { eventType: 'INSERT', old: {}, new: { id: 'c', name: 'Apples' } }, { sort: byName })
    expect(next.map(r => r.name)).toEqual(['Apples', 'Beans', 'Rice'])
  })

  it('treats an undefined cache (query never fetched) as empty for INSERT and leaves it alone for DELETE', () => {
    expect(applyChange(undefined, { eventType: 'INSERT', old: {}, new: { id: 'c' } })).toEqual([{ id: 'c' }])
    expect(applyChange(undefined, { eventType: 'DELETE', old: { id: 'c' }, new: {} })).toBeUndefined()
  })
})
