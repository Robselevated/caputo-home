// Page text for the model: tags gone, structure kept, centred on the recipe.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', deg: '°', frac12: '½', frac14: '¼', frac34: '¾' }

export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z0-9]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

export function htmlToText(html) {
  let s = String(html || '')
  s = s.replace(/<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr|section|article|ul|ol|blockquote|dd|dt|header|footer|figcaption)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)
  return s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim()
}

export function recipeWindow(text, max = 12000) {
  const s = String(text || '')
  if (s.length <= max) return s
  const idx = s.search(/\bingredients\b/i)
  if (idx === -1) return s.slice(0, max)
  const start = Math.min(Math.max(0, idx - Math.floor(max * 0.12)), s.length - max)
  return s.slice(start, start + max)
}

// WordPress Recipe Maker groups: [{ name, count }] in page order.
export function sectionHints(html) {
  const out = []
  const re = /<[^>]*class="[^"]*wprm-recipe-ingredient-group[^"]*"[^>]*>([\s\S]*?)(?=<[^>]*class="[^"]*wprm-recipe-ingredient-group[^"]*"|$)/gi
  let m
  while ((m = re.exec(String(html || ''))) !== null) {
    const block = m[1]
    const name = (block.match(/wprm-recipe-group-name[^>]*>([^<]+)</i) || [])[1]
    const count = (block.match(/class="[^"]*\bwprm-recipe-ingredient\b[^"]*"/gi) || []).filter(c => !/ingredient-group|ingredients/i.test(c)).length
    if (name && count) out.push({ name: name.trim().replace(/:$/, ''), count })
  }
  return out
}

export function extractOgImage(html) {
  const s = String(html || '')
  const og = s.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || s.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  if (og) return og[1]
  const tw = s.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) || s.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i)
  return tw ? tw[1] : null
}
