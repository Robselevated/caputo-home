// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { isPublicHttpUrl, fetchContent } from './fetchPage.js'
import { createDeadline } from './budget.js'

const resp = (status, body, url) => ({ ok: status >= 200 && status < 300, status, url, text: async () => body, json: async () => JSON.parse(body) })
const LD = '<html><script type="application/ld+json">{"@type":"Recipe"}</script><body>Ingredients</body></html>'

describe('isPublicHttpUrl', () => {
  it.each([
    ['https://example.com/recipe', true], ['http://example.com', true],
    ['ftp://example.com', false], ['https://localhost/x', false], ['http://127.0.0.1/', false], ['http://127.1.2.3/', false],
    ['http://0.0.0.0/', false], ['http://10.0.0.1/', false], ['http://192.168.1.1/', false], ['http://172.16.5.5/', false],
    ['http://169.254.169.254/latest', false], ['http://[::1]/', false], ['http://[fe80::1]/', false], ['http://box.local/', false],
    ['not a url', false],
  ])('%s -> %s', (url, ok) => {
    expect(isPublicHttpUrl(url)).toBe(ok)
  })
})

describe('fetchContent', () => {
  it('returns the direct page when it is useful and never calls Firecrawl', async () => {
    const fetchImpl = vi.fn(async () => resp(200, LD, 'https://example.com/recipe'))
    const out = await fetchContent('https://example.com/recipe', createDeadline(50000), { fetchImpl, firecrawlKey: 'k' })
    expect(out).toMatchObject({ via: 'direct', status: 200, finalUrl: 'https://example.com/recipe' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('falls back to Firecrawl on a block status', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(403, 'blocked', 'https://example.com/recipe'))
      .mockResolvedValueOnce(resp(200, JSON.stringify({ success: true, data: { rawHtml: LD } }), 'https://api.firecrawl.dev/v1/scrape'))
    const out = await fetchContent('https://example.com/recipe', createDeadline(50000), { fetchImpl, firecrawlKey: 'k' })
    expect(out.via).toBe('firecrawl')
    expect(out.html).toContain('Recipe')
    expect(fetchImpl.mock.calls[1][0]).toBe('https://api.firecrawl.dev/v1/scrape')
  })
  it('reports a blocked site when both the page and Firecrawl refuse', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(402, '', 'https://www.allrecipes.com/x'))
      .mockResolvedValueOnce(resp(403, JSON.stringify({ success: false, error: 'we do not support this site' }), 'https://api.firecrawl.dev/v1/scrape'))
    await expect(fetchContent('https://www.allrecipes.com/x', createDeadline(50000), { fetchImpl, firecrawlKey: 'k' })).rejects.toMatchObject({ code: 'blocked' })
  })
  it('rejects a redirect that lands on a private address', async () => {
    const fetchImpl = vi.fn(async () => resp(200, LD, 'http://127.0.0.1/admin'))
    await expect(fetchContent('https://example.com/r', createDeadline(50000), { fetchImpl })).rejects.toMatchObject({ code: 'invalid_url' })
  })

  it('reports a site that is merely down as unreachable, not blocked', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(503, '', 'https://blog.test/x'))
      .mockResolvedValueOnce(resp(500, JSON.stringify({ success: false, error: 'internal' }), 'https://api.firecrawl.dev/v1/scrape'))
    await expect(fetchContent('https://blog.test/x', createDeadline(50000), { fetchImpl, firecrawlKey: 'k' })).rejects.toMatchObject({ code: 'fetch_failed' })
  })
})

