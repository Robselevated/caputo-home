// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { blockedReason } from './blockedSites.js'

describe('blockedReason', () => {
  it('names the sites that refuse automated readers', () => {
    expect(blockedReason('https://www.allrecipes.com/recipe/16354/easy-meatloaf/')).toMatch(/^allrecipes\.com does not let apps read its pages/)
    expect(blockedReason('https://www.seriouseats.com/x')).toContain('Paste')
  })
  it('passes everything else', () => {
    expect(blockedReason('https://www.budgetbytes.com/x')).toBeNull()
    expect(blockedReason('nonsense')).toBeNull()
  })
})
