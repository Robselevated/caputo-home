import { withTimeout, TimeoutError } from './budget.js'

export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
export const BLOCK_STATUSES = new Set([401, 402, 403, 406, 451, 460])

export class FetchError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'FetchError'
    this.code = code
    this.status = status
  }
}

// Public http(s) only: no loopback, link-local, private ranges, IPv6 locals
// or local hostnames, so a crafted link cannot reach anything inside Netlify.
export function isPublicHttpUrl(url) {
  let u
  try { u = new URL(String(url)) } catch { return false }
  if (!['http:', 'https:'].includes(u.protocol)) return false
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!h || h === 'localhost' || /\.(local|localhost|internal|home|lan)$/.test(h)) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return false
    return true
  }
  if (h.includes(':')) {
    if (h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:')) return false
  }
  return true
}

const looksUseful = (html) => /application\/ld\+json/i.test(html) || /ingredients/i.test(html)

// Direct fetch first; Firecrawl when the site blocks us or the page has
// nothing recipe-like. Both bounded by the deadline.
export async function fetchContent(url, deadline, {
  fetchImpl = globalThis.fetch, firecrawlKey = process.env.FIRECRAWL_API_KEY, directMs = 8000, firecrawlMs = 15000, maxBytes = 3_000_000,
} = {}) {
  if (!isPublicHttpUrl(url)) throw new FetchError('That link does not look right.', 'invalid_url')
  let direct = null
  let directErr = null
  try {
    const resp = await withTimeout(fetchImpl(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: deadline.signal(directMs),
    }), directMs, 'page fetch')
    const finalUrl = resp.url || url
    if (!isPublicHttpUrl(finalUrl)) throw new FetchError('That link does not look right.', 'invalid_url')
    const text = await resp.text()
    direct = { status: resp.status, ok: resp.ok, html: text.slice(0, maxBytes), finalUrl }
  } catch (e) {
    if (e?.code === 'invalid_url') throw e
    directErr = e
  }
  if (direct?.ok && looksUseful(direct.html)) return { html: direct.html, status: direct.status, via: 'direct', finalUrl: direct.finalUrl }
  if (deadline.expired) throw new TimeoutError('page fetch')

  let fc = null
  if (firecrawlKey) {
    try {
      const resp = await withTimeout(fetchImpl('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${firecrawlKey}` },
        body: JSON.stringify({ url, formats: ['rawHtml'] }),
        signal: deadline.signal(firecrawlMs),
      }), firecrawlMs, 'Firecrawl')
      const json = await resp.json().catch(() => null)
      const html = json?.data?.rawHtml || json?.data?.html || ''
      if (resp.ok && json?.success && html) {
        return { html: html.slice(0, maxBytes), status: 200, via: 'firecrawl', finalUrl: json?.data?.metadata?.sourceURL || url }
      }
      fc = { status: resp.status, error: String(json?.error || '') }
    } catch (e) {
      fc = { status: 0, error: String(e?.message || e) }
    }
  }
  if (direct?.ok) return { html: direct.html, status: direct.status, via: 'direct', finalUrl: direct.finalUrl }

  const blocked = (direct && BLOCK_STATUSES.has(direct.status))
    || (fc && (BLOCK_STATUSES.has(fc.status) || /not support|unsupported|blocked|forbidden/i.test(fc.error)))
  if (blocked) throw new FetchError('The site refused automated access.', 'blocked', direct?.status)
  if (directErr?.name === 'TimeoutError' || /timed out/i.test(fc?.error || '')) throw new TimeoutError('page fetch')
  throw new FetchError(`Could not fetch the page (${direct?.status ?? directErr?.message ?? 'no response'})`, 'fetch_failed', direct?.status)
}
