#!/usr/bin/env node
// Runs the recipe import cores against real inputs with the deployed keys.
//   npm run probe -- url <url...>
//   npm run probe -- image <file...>
//   npm run probe -- text <file>
//   npm run probe -- suggest [model...]   (meal ideas + expand the first, per model)
// CLAUDE_API_KEY and FIRECRAWL_API_KEY come from `netlify env:list` in-process
// (the local .env.local copies are stale since the 2026-07 rotation). Values
// are never printed. No auth, no rate-limit rows: the handlers are bypassed.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

try {
  const list = JSON.parse(execSync('npx --no-install netlify env:list --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  for (const k of ['CLAUDE_API_KEY', 'FIRECRAWL_API_KEY']) if (list[k]) process.env[k] = list[k]
} catch {
  console.error('Could not read the Netlify env; using the process env as is.')
}

const [mode, ...args] = process.argv.slice(2)
const { createDeadline } = await import('../netlify/functions/lib/budget.js')
const { makeClient } = await import('../netlify/functions/lib/anthropicClient.js')

function print(label, status, body, ms) {
  const out = { status, ms }
  if (body?.error) out.error = body.error
  if (body?.name !== undefined || body?.ingredients) {
    const ings = body.ingredients || []
    Object.assign(out, {
      via: body.via, name: body.name, servings: body.servings, yield_text: body.yield_text, prep: body.prep_time, cook: body.cook_time,
      image: body.image_url ? String(body.image_url).slice(0, 70) : null, tags: body.tags,
      ingredientCount: ings.length,
      badQty: ings.filter(i => i.qty != null && !(typeof i.qty === 'number' && Number.isFinite(i.qty))).map(i => i.name),
      ingredients: ings.slice(0, 14).map(i => `${i.section ? '[' + i.section + '] ' : ''}${i.qty_text ?? ''} ${i.unit ?? ''} ${i.name}${i.notes ? ' (' + i.notes + ')' : ''}`.replace(/\s+/g, ' ').trim()),
      instructions: typeof body.instructions === 'string' ? `${body.instructions.split('\n').length} lines` : body.instructions,
    })
  }
  console.log(`\n### ${label}`)
  console.log(JSON.stringify(out, null, 1))
}

async function run(label, fn) {
  const t = Date.now()
  let res
  try { res = await fn() } catch (e) { res = { status: 'THROW', body: { error: e.message } } }
  print(label, res.status, res.body, Date.now() - t)
}

const mediaType = (f) => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(f).toLowerCase()] || 'image/jpeg'

if (mode === 'url') {
  const { parseRecipeFromUrl } = await import('../netlify/functions/lib/recipe-url.js')
  for (const url of args) await run(url, () => parseRecipeFromUrl(url, { client: makeClient(), deadline: createDeadline() }))
} else if (mode === 'image') {
  const { parseRecipeFromImages } = await import('../netlify/functions/lib/recipe-image.js')
  const images = args.map(f => ({ base64: fs.readFileSync(f).toString('base64'), media_type: mediaType(f) }))
  await run(args.join(' + '), () => parseRecipeFromImages(images, { client: makeClient(), deadline: createDeadline() }))
} else if (mode === 'text') {
  const { parseRecipeFromText } = await import('../netlify/functions/lib/recipe-text.js')
  const text = fs.readFileSync(args[0], 'utf8')
  await run(args[0], () => parseRecipeFromText(text, { client: makeClient(), deadline: createDeadline() }))
} else if (mode === 'suggest') {
  const { suggestRecipes, expandSuggestion } = await import('../netlify/functions/lib/suggestions.js')
  const { MODEL } = await import('../netlify/functions/lib/anthropicClient.js')
  const pantry = ['chicken thighs', 'rice', 'yellow onion', 'garlic', 'soy sauce', 'eggs', 'frozen peas', 'carrots', 'butter',
    'all-purpose flour', 'milk', 'cheddar cheese', 'canned diced tomatoes', 'pasta', 'olive oil', 'lemons', 'spinach', 'black beans',
    'tortillas', 'ground beef', 'potatoes', 'parmesan', 'heavy cream', 'green onions', 'ginger'].map(name => ({ name, qty: 1 }))
  // "before" is the old setup (Sonnet 4.6, max_tokens 4096) through the same code path.
  const models = args.length ? args : ['claude-sonnet-4-6:4096', MODEL]
  for (const spec of models) {
    const [model, cap] = spec.split(':')
    const opts = (max_tokens) => ({ client: makeClient(), deadline: createDeadline(), model, ...(max_tokens ? { max_tokens } : {}) })
    let t = Date.now()
    const s = await suggestRecipes(pantry, opts(cap && Number(cap)))
    const sMs = Date.now() - t
    console.log(`\n### suggest ${spec}`)
    console.log(JSON.stringify({ status: s.status, ms: sMs, count: Array.isArray(s.body) ? s.body.length : 0, error: s.body?.error,
      ideas: Array.isArray(s.body) ? s.body.map(x => `${x.name} (${x.difficulty}, ${x.time_estimate}m) uses ${x.matched_ingredients.length}, needs [${x.missing_ingredients.join(', ')}]`) : null }, null, 1))
    if (s.status !== 200) continue
    t = Date.now()
    const e = await expandSuggestion(s.body[0], opts(cap && Number(cap)))
    const r = e.body
    console.log(`### expand ${spec}`)
    console.log(JSON.stringify({ status: e.status, ms: Date.now() - t, error: r?.error, name: r?.name, servings: r?.servings, prep: r?.prep_time, cook: r?.cook_time,
      tags: r?.tags, ingredientCount: r?.ingredients?.length, ingredients: r?.ingredients?.map(i => `${i.section ? '[' + i.section + '] ' : ''}${i.qty ?? ''} ${i.unit ?? ''} ${i.name}${i.notes ? ' (' + i.notes + ')' : ''}`),
      steps: typeof r?.instructions === 'string' ? r.instructions.split('\n').filter(Boolean).length : null }, null, 1))
  }
} else {
  console.log('usage: npm run probe -- url <url...> | image <file...> | text <file> | suggest [model[:max_tokens]...]')
  process.exit(1)
}
