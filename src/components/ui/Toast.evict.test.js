import { describe, it, expect } from 'vitest'
import { evictionIndex } from './Toast'

const plain = (id) => ({ id })
const undo = (id) => ({ id, action: { label: 'Undo' } })

describe('evictionIndex', () => {
  it('keeps two toasts as they are', () => {
    expect(evictionIndex([plain(1), undo(2)])).toBe(-1)
  })
  it('drops the oldest plain message before any Undo', () => {
    expect(evictionIndex([undo(1), plain(2), undo(3)])).toBe(1)
  })
  it('keeps three Undo toasts, and drops the oldest only past three', () => {
    expect(evictionIndex([undo(1), undo(2), undo(3)])).toBe(-1)
    expect(evictionIndex([undo(1), undo(2), undo(3), undo(4)])).toBe(0)
  })
})
