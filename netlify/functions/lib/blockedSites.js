// Publishers that refuse every automated reader, Firecrawl included. Trying
// only burns time; the user is told to paste the recipe text instead.
export const BLOCKED_HOSTS = [
  'allrecipes.com', 'simplyrecipes.com', 'seriouseats.com', 'foodandwine.com', 'eatingwell.com',
  'thespruceeats.com', 'marthastewart.com', 'bhg.com', 'southernliving.com', 'realsimple.com',
]

export function blockedHost(urlOrHost) {
  let host
  try { host = new URL(String(urlOrHost)).hostname } catch { host = String(urlOrHost || '') }
  host = host.toLowerCase().replace(/^www\./, '')
  return BLOCKED_HOSTS.find(b => host === b || host.endsWith(`.${b}`)) || null
}

export function blockedMessage(host) {
  return `${host} does not let apps read its pages. Copy the recipe text from the page and use Paste instead.`
}

export function blockedReason(urlOrHost) {
  const host = blockedHost(urlOrHost)
  return host ? blockedMessage(host) : null
}
