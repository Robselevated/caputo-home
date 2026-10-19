// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { htmlToText, recipeWindow, sectionHints, extractOgImage } from './htmlText.js'

describe('htmlToText', () => {
  it('drops scripts and tags, keeps line structure and decodes entities', () => {
    const html = '<html><head><style>.x{}</style><script>var a=1</script></head><body><h2>Ingredients</h2><ul><li>1 cup rice &amp; beans</li><li>2 eggs</li></ul><p>Cook&nbsp;it.<br>Serve.</p></body></html>'
    expect(htmlToText(html)).toBe('Ingredients\n1 cup rice & beans\n2 eggs\nCook it.\nServe.')
  })
})

describe('recipeWindow', () => {
  it('returns short text whole and centres long text on the Ingredients heading', () => {
    expect(recipeWindow('short', 100)).toBe('short')
    const text = 'x'.repeat(5000) + '\nIngredients\n1 egg\n' + 'y'.repeat(5000)
    const w = recipeWindow(text, 1000)
    expect(w.length).toBe(1000)
    expect(w).toContain('Ingredients\n1 egg')
    expect(w.indexOf('Ingredients')).toBeLessThan(400)
  })
})

describe('sectionHints', () => {
  it('reads WordPress ingredient groups with their row counts', () => {
    const html = '<div class="wprm-recipe-ingredient-group"><h4 class="wprm-recipe-group-name">Soup:</h4><ul><li class="wprm-recipe-ingredient">a</li><li class="wprm-recipe-ingredient">b</li></ul></div><div class="wprm-recipe-ingredient-group"><h4 class="wprm-recipe-group-name">Crisps</h4><ul><li class="wprm-recipe-ingredient">c</li></ul></div>'
    expect(sectionHints(html)).toEqual([{ name: 'Soup', count: 2 }, { name: 'Crisps', count: 1 }])
    expect(sectionHints('<p>nothing</p>')).toEqual([])
  })
})

describe('extractOgImage', () => {
  it('prefers og:image, then twitter:image', () => {
    expect(extractOgImage('<meta property="og:image" content="https://x/og.jpg"><meta name="twitter:image" content="https://x/tw.jpg">')).toBe('https://x/og.jpg')
    expect(extractOgImage('<meta name="twitter:image" content="https://x/tw.jpg">')).toBe('https://x/tw.jpg')
    expect(extractOgImage('<p>none</p>')).toBeNull()
  })
})
