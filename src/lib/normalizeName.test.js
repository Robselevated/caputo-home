import { describe, it, expect } from 'vitest'
import { normalizeName } from './normalizeName'

// Mirrors the SQL generated column:
//   lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))
describe('normalizeName', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeName('  Half   &  Half ')).toBe('half & half')
  })

  it('collapses tabs and newlines like SQL \\s+', () => {
    expect(normalizeName('Brown\t\nSugar')).toBe('brown sugar')
  })

  it('leaves % and _ literal (no ilike wildcards anymore)', () => {
    expect(normalizeName('2% Milk_Whole')).toBe('2% milk_whole')
  })

  it('returns empty string for null/undefined/non-strings', () => {
    expect(normalizeName(null)).toBe('')
    expect(normalizeName(undefined)).toBe('')
    expect(normalizeName(42)).toBe('')
  })
})
