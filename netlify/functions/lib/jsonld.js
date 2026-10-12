// schema.org Recipe structured data -> the import contract, with no model call.
import { parseIngredientLine } from '../../../src/lib/ingredientParse.js'

const isRecipe = (n) => !!n && typeof n === 'object' && (n['@type'] === 'Recipe' || (Array.isArray(n['@type']) && n['@type'].includes('Recipe')))

function search(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 4) return null
  if (isRecipe(node)) return node
  if (Array.isArray(node)) {
    for (const item of node) { const hit = search(item, depth + 1); if (hit) return hit }
    return null
  }
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'about']) {
    if (node[key]) { const hit = search(node[key], depth + 1); if (hit) return hit }
  }
  return null
}

export function findRecipeNode(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(String(html || ''))) !== null) {
    let data
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const hit = search(data)
    if (hit) return hit
  }
  return null
}

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
const str = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : (v.name ?? v.text ?? v['@value'] ?? '')).toString().trim()

export function isoDurationToMinutes(v) {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null
  const s = String(v).trim()
  const m = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i)
  if (m) {
    const mins = (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) + Math.round((+(m[4] || 0)) / 60)
    return mins > 0 ? mins : null
  }
  const plain = s.match(/^(\d+)\s*(min|mins|minutes?)?$/i)
  return plain ? +plain[1] : null
}

export function parseYield(v) {
  if (v == null || v === '') return { servings: null, yield_text: null }
  if (typeof v === 'number') return { servings: Number.isFinite(v) ? Math.round(v) : null, yield_text: null }
  const items = asArray(v).map(str).filter(Boolean)
  if (!items.length) return { servings: null, yield_text: null }
  const text = items.reduce((a, b) => (b.length > a.length ? b : a), '')
  const lead = text.match(/^\s*(\d+)/)
  const servings = lead ? +lead[1] : null
  return { servings, yield_text: /^\d+$/.test(text) ? null : text }
}

export function imageUrl(img) {
  if (!img) return null
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return imageUrl(img[0])
  return img.url || img.contentUrl || img['@id'] || null
}

export function instructionsToText(v) {
  const lines = []
  let n = 0
  const step = (text) => { const t = str(text); if (t) lines.push(`${++n}. ${t}`) }
  const walk = (item) => {
    if (item == null) return
    if (typeof item === 'string') {
      const parts = item.split(/\r?\n+/).map(s => s.trim()).filter(Boolean)
      parts.forEach(p => step(p.replace(/^\d+[.)]\s*/, '')))
    } else if (Array.isArray(item)) {
      item.forEach(walk)
    } else if (item['@type'] === 'HowToSection' || (item.itemListElement && !item.text)) {
      const heading = str(item.name)
      if (heading) lines.push(heading)
      walk(item.itemListElement)
    } else {
      step(item.text || item.name)
    }
  }
  walk(v)
  return lines.join('\n') || null
}

function tagsFrom(node) {
  const out = []
  const push = (v) => { for (const t of asArray(v)) for (const part of String(str(t)).split(',')) { const p = part.trim(); if (p && !out.includes(p)) out.push(p) } }
  push(node.keywords); push(node.recipeCategory); push(node.recipeCuisine)
  return out.slice(0, 10)
}

// sectionHints: [{ name, count }] from WordPress group markup, applied in order.
export function mapJsonLdRecipe(node, { url, ogImage, sectionHints = [] } = {}) {
  if (!node) return null
  const name = str(node.name)
  const lines = asArray(node.recipeIngredient).map(str).filter(Boolean)
  const ingredients = []
  let section = ''
  for (const line of lines) {
    const r = parseIngredientLine(line, { section })
    if (!r) continue
    if (r.section !== undefined && r.name === undefined) { section = r.section; continue }
    if (r.instruction) continue
    ingredients.push({ section: r.section || null, name: r.name, qty: r.qty, qty_text: r.qty_text || null, unit: r.unit || null, notes: r.notes || null })
  }
  if (sectionHints.length && ingredients.every(i => !i.section)) {
    let i = 0
    for (const hint of sectionHints) for (let k = 0; k < hint.count && i < ingredients.length; k++) ingredients[i++].section = hint.name
  }
  if (!name || ingredients.length === 0) return null

  const prep = isoDurationToMinutes(node.prepTime)
  const cook = isoDurationToMinutes(node.cookTime)
  const total = isoDurationToMinutes(node.totalTime) ?? (prep != null || cook != null ? (prep || 0) + (cook || 0) : null)
  const { servings, yield_text } = parseYield(node.recipeYield)
  return {
    name,
    description: str(node.description) || null,
    image_url: imageUrl(node.image) || ogImage || null,
    servings,
    yield_text,
    prep_time: prep,
    cook_time: cook,
    total_time: total,
    tags: tagsFrom(node),
    instructions: instructionsToText(node.recipeInstructions),
    source_url: url || str(node.url) || null,
    via: 'jsonld',
    ingredients,
  }
}
