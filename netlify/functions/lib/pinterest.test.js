// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { isPinterestUrl, pinIdFromUrl, resolvePin } from './pinterest.js'

const widget = { status: 'success', data: [{ id: '410812797279838137', link: 'https://sweetlittlebluebird.com/easy-baked-lemon-garlic-chicken-thighs/?utm_source=pinterest', description: 'Try this easy recipe', images: { '236x': { url: 'https://i.pinimg.com/236x/a.jpg' }, '564x': { url: 'https://i.pinimg.com/564x/a.jpg' } }, pinner: { full_name: 'Mary' } }] }

describe('pinterest urls', () => {
  it('recognises pin pages and short links and reads the pin id', () => {
    expect(isPinterestUrl('https://www.pinterest.com/pin/410812797279838137/')).toBe(true)
    expect(isPinterestUrl('https://pin.it/4kXqZ3P')).toBe(true)
    expect(isPinterestUrl('https://www.budgetbytes.com/x')).toBe(false)
    expect(pinIdFromUrl('https://www.pinterest.com/pin/410812797279838137/')).toBe('410812797279838137')
    expect(pinIdFromUrl('https://www.pinterest.com/pin/lemon-garlic-chicken-thighs--211174974405773/')).toBe('211174974405773')
    expect(pinIdFromUrl('https://www.pinterest.com/user/board/')).toBeNull()
  })
})

describe('resolvePin', () => {
  it('reads the source link, description and image from the widget endpoint', async () => {
    const fetchImpl = vi.fn(async (url) => ({ ok: true, status: 200, url, json: async () => widget, text: async () => '' }))
    const pin = await resolvePin('https://www.pinterest.com/pin/410812797279838137/', { fetchImpl })
    expect(pin).toEqual({ pinId: '410812797279838137', link: 'https://sweetlittlebluebird.com/easy-baked-lemon-garlic-chicken-thighs/', description: 'Try this easy recipe', title: '', imageUrl: 'https://i.pinimg.com/564x/a.jpg' })
    expect(fetchImpl.mock.calls[0][0]).toContain('pin_ids=410812797279838137')
  })
  it('follows a pin.it short link to the pin first', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, url: 'https://www.pinterest.com/pin/410812797279838137/', text: async () => '', json: async () => ({}), body: null })
      .mockResolvedValueOnce({ ok: true, status: 200, url: 'w', json: async () => widget, text: async () => '' })
    const pin = await resolvePin('https://pin.it/4kXqZ3P', { fetchImpl })
    expect(pin.pinId).toBe('410812797279838137')
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'follow' })
  })
  it('returns null when the endpoint has nothing', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, url: 'w', json: async () => ({ status: 'failure', data: [] }), text: async () => '' }))
    expect(await resolvePin('https://www.pinterest.com/pin/1/', { fetchImpl })).toBeNull()
  })
})
