import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { collectIconNames, iconNamesInIndexHtml } from '../../scripts/material-icon-names.mjs'

const root = path.resolve(__dirname, '../..')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

describe('Material Symbols subset in index.html', () => {
  it('includes every icon name the app renders', () => {
    const used = collectIconNames(path.join(root, 'src'))
    const subset = new Set(iconNamesInIndexHtml(html))
    const missing = used.filter(n => !subset.has(n))
    expect(missing).toEqual([])
  })

  it('lists the names in alphabetical order (Google Fonts rejects unsorted lists)', () => {
    const subset = iconNamesInIndexHtml(html)
    expect(subset.length).toBeGreaterThan(0)
    expect(subset).toEqual([...subset].sort())
  })

  it('loads the icon font with display=block so names never flash as text', () => {
    const iconLink = html.split('\n').find(l => l.includes('Material+Symbols+Outlined') && l.includes('<link'))
    expect(iconLink).toBeTruthy()
    expect(iconLink).toContain('display=block')
  })
})
