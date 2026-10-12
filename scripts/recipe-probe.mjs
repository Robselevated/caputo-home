#!/usr/bin/env node
// Runs the recipe import cores against real inputs with the deployed keys.
//   npm run probe -- url <url...>
//   npm run probe -- image <file...>
//   npm run probe -- text <file>
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
} else {
  console.log('usage: npm run probe -- url <url...> | image <file...> | text <file>')
  process.exit(1)
}
