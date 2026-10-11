import { describe, it, expect } from 'vitest'
import { storeTheme, storeLabel } from './storeTheme'

describe('storeTheme', () => {
  it('gives each preset store its own tile, ink and accent classes', () => {
    const p = storeTheme("Pilgrim's"), c = storeTheme('Costco'), g = storeTheme('Grocery Store')
    for (const t of [p, c, g]) {
      expect(t.tile).toMatch(/^bg-store-/)
      expect(t.ink).toMatch(/^text-store-/)
      expect(t.ring).toMatch(/^border-store-/)
      expect(t.accentBg).toMatch(/^bg-store-/)
    }
    expect(new Set([p.tile, c.tile, g.tile]).size).toBe(3)
  })

  it('treats the legacy "Pilgrams" spelling as Pilgrim\'s and unknown stores as neutral', () => {
    expect(storeTheme('Pilgrams')).toEqual(storeTheme("Pilgrim's"))
    expect(storeTheme('Trader Joe\'s').tile).toBe('bg-store-other-tile')
    expect(storeTheme(null)).toEqual(storeTheme('Grocery Store'))
  })

  it('labels a missing store as Grocery Store', () => {
    expect(storeLabel(null)).toBe('Grocery Store')
    expect(storeLabel('Costco')).toBe('Costco')
  })
})
