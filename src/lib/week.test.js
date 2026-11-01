import { describe, it, expect } from 'vitest'
import { startOfWeek, addDays, toDateKey, weekDays, weekLabel } from './week'

describe('week helpers', () => {
  it('startOfWeek is the Monday of the week, Sunday included', () => {
    expect(toDateKey(startOfWeek(new Date(2026, 10, 4)))).toBe('2026-11-02')
    expect(toDateKey(startOfWeek(new Date(2026, 10, 2)))).toBe('2026-11-02')
    expect(toDateKey(startOfWeek(new Date(2026, 10, 1)))).toBe('2026-10-26')
  })

  it('toDateKey uses the local date even late in the evening', () => {
    expect(toDateKey(new Date(2026, 10, 2, 23, 30))).toBe('2026-11-02')
  })

  it('addDays crosses months and the DST change cleanly', () => {
    expect(toDateKey(addDays(new Date(2026, 9, 30), 3))).toBe('2026-11-02')
    expect(toDateKey(addDays(new Date(2026, 10, 1), 1))).toBe('2026-11-02')
  })

  it('weekDays lists Mon to Sun with keys', () => {
    const days = weekDays(new Date(2026, 10, 2))
    expect(days.map(d => d.name)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(days[6].key).toBe('2026-11-08')
  })

  it('weekLabel names this, next and last week, else just the range', () => {
    const today = new Date(2026, 10, 4)
    expect(weekLabel(new Date(2026, 10, 2), today)).toBe('This week · Nov 2–8')
    expect(weekLabel(new Date(2026, 10, 9), today)).toBe('Next week · Nov 9–15')
    expect(weekLabel(new Date(2026, 9, 26), today)).toBe('Last week · Oct 26 – Nov 1')
    expect(weekLabel(new Date(2026, 10, 16), today)).toBe('Nov 16–22')
  })
})
