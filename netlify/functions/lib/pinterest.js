import { UA } from './fetchPage.js'

// A pin page is an app shell; the recipe is on the site the pin points to.
// Pinterest's public widget endpoint returns that link without a login.
export function isPinterestUrl(url) {
  try {
    const h = new URL(String(url)).hostname.toLowerCase()
    return h === 'pin.it' || /(^|\.)pinterest\.[a-z.]+$/.test(h)
  } catch { return false }
}

export function pinIdFromUrl(url) {
  const m = String(url || '').match(/\/pin\/(?:[^/]*?--)?(\d+)\/?/)
  return m ? m[1] : null
}

function cleanLink(link) {
  if (!link) return null
  try {
    const u = new URL(link)
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k)
    return u.toString()
  } catch { return null }
}

export async function resolvePin(url, { fetchImpl = globalThis.fetch, signal } = {}) {
  let pinUrl = String(url)
  if (/^https?:\/\/pin\.it\//i.test(pinUrl)) {
    const r = await fetchImpl(pinUrl, { redirect: 'follow', signal, headers: { 'User-Agent': UA } })
    pinUrl = r.url || pinUrl
    try { await r.body?.cancel?.() } catch { /* body already consumed */ }
  }
  const pinId = pinIdFromUrl(pinUrl)
  if (!pinId) return null
  const r = await fetchImpl(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`, { signal, headers: { 'User-Agent': UA, Accept: 'application/json' } })
  const json = await r.json().catch(() => null)
  const pin = json?.data?.[0]
  if (!pin) return null
  const images = pin.images || {}
  const imageUrl = images['564x']?.url || images['736x']?.url || images['474x']?.url || images['236x']?.url || null
  const title = String(pin.title || pin.grid_title || pin.rich_metadata?.title || '').trim()
  return { pinId, link: cleanLink(pin.link), description: String(pin.description || '').trim(), title, imageUrl }
}
