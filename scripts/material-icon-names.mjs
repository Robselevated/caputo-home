// Scans src/ for every Material Symbols icon name the app renders, so the
// Google Fonts request in index.html can be subset with `icon_names=` (a few
// KB instead of the full ~300KB variable font, and no flash of icon names as
// text). Run `node scripts/material-icon-names.mjs` to print the list.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME = /[a-z][a-z0-9_]*/

export function collectIconNames(srcDir) {
  const names = new Set()
  const add = (n) => { if (NAME.test(n)) names.add(n) }

  for (const file of walk(srcDir)) {
    if (/\.test\.[jt]sx?$/.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    // <span className="material-symbols-outlined ...">name</span>
    for (const m of text.matchAll(/material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*</g)) add(m[1])
    // <span className="material-symbols-outlined ...">{cond ? 'a' : 'b'}</span>
    for (const m of text.matchAll(/material-symbols-outlined[^>]*>\s*\{([^}]*)\}\s*</g)) {
      for (const lit of m[1].matchAll(/'([a-z][a-z0-9_]*)'/g)) add(lit[1])
    }
    // const X_ICONS = { key: 'name', ... }
    for (const m of text.matchAll(/_ICONS\s*=\s*\{([\s\S]*?)\n\}/g)) {
      for (const lit of m[1].matchAll(/:\s*'([a-z][a-z0-9_]*)'/g)) add(lit[1])
    }
    // { path: '/x', icon: 'name' }
    for (const m of text.matchAll(/\bicon:\s*'([a-z][a-z0-9_]*)'/g)) add(m[1])
    // <PhotoScanner icon="receipt_long" /> and function defaults: icon = 'photo_camera'
    for (const m of text.matchAll(/\bicon\s*=\s*['"]([a-z][a-z0-9_]*)['"]/g)) add(m[1])
    // Over-inclusive guard: any short lowercase_snake literal within 400 chars after a
    // material-symbols span opening. False positives only cost a few glyphs.
    for (const m of text.matchAll(/material-symbols-outlined[\s\S]{0,400}?/g)) {
      for (const lit of m[0].matchAll(/['"]([a-z][a-z0-9]*_[a-z0-9_]*)['"]/g)) add(lit[1])
    }
  }
  return [...names].sort()
}

export function iconNamesInIndexHtml(html) {
  const m = html.match(/icon_names=([a-z0-9_,]+)/)
  return m ? m[1].split(',') : []
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) yield p
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  console.log(collectIconNames(path.join(root, 'src')).join(','))
}
