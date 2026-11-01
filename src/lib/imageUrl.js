// Recipe photos are stored full size, on Supabase or on the recipe's own site
// (up to 2 MB each). In production Netlify's Image CDN resizes them on our own
// origin, so a grid card downloads a few KB and the service worker keeps it.
// The dev server has no /.netlify/images, so there the original URL is used.
export function thumbUrl(url, width, enabled = import.meta.env.PROD) {
  if (!enabled || !url || !/^https:\/\//i.test(url)) return url
  return `/.netlify/images?url=${encodeURIComponent(url)}&w=${width}&q=70`
}
