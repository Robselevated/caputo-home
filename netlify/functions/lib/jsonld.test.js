// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { findRecipeNode, mapJsonLdRecipe, isoDurationToMinutes, parseYield } from './jsonld.js'

const ld = (obj) => `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body></body></html>`

const yoast = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Article', headline: 'A post' },
    {
      '@type': ['Recipe', 'NewsArticle'], name: 'Easy Baked Lemon Garlic Chicken Thighs', description: 'Weeknight winner.',
      image: { '@type': 'ImageObject', url: 'https://example.com/chicken.jpg' },
      recipeYield: ['4', '4 servings'], prepTime: 'PT10M', cookTime: 'PT35M', totalTime: 'PT45M',
      keywords: 'chicken, easy, dinner', recipeCategory: 'Main Course', recipeCuisine: ['American'],
      recipeIngredient: ['2 lbs chicken thighs, bone-in', '3 Tbsp. olive oil', '1 (15 oz) can chickpeas', 'Salt to taste'],
      recipeInstructions: [
        { '@type': 'HowToSection', name: 'Prep', itemListElement: [{ '@type': 'HowToStep', text: 'Preheat oven to 375°F.' }, { '@type': 'HowToStep', text: 'Pat the chicken dry.' }] },
        { '@type': 'HowToStep', text: 'Roast 35 minutes.' },
      ],
    },
  ],
}

describe('findRecipeNode', () => {
  it('finds a Recipe inside a Yoast @graph even when @type is an array', () => {
    expect(findRecipeNode(ld(yoast))?.name).toBe('Easy Baked Lemon Garlic Chicken Thighs')
  })
  it('finds a top-level Recipe, one inside an array, and one under mainEntity', () => {
    expect(findRecipeNode(ld({ '@type': 'Recipe', name: 'Top' }))?.name).toBe('Top')
    expect(findRecipeNode(ld([{ '@type': 'WebPage' }, { '@type': 'Recipe', name: 'InArray' }]))?.name).toBe('InArray')
    expect(findRecipeNode(ld({ '@type': 'WebPage', mainEntity: { '@type': 'Recipe', name: 'Main' } }))?.name).toBe('Main')
  })
  it('skips broken JSON blocks and returns null when there is no recipe', () => {
    const html = '<script type="application/ld+json">{not json</script>' + ld({ '@type': 'SocialMediaPosting' })
    expect(findRecipeNode(html)).toBeNull()
  })
})

describe('mapJsonLdRecipe', () => {
  it('maps the node onto the import contract without a model call', () => {
    const r = mapJsonLdRecipe(findRecipeNode(ld(yoast)), { url: 'https://example.com/post', ogImage: 'https://example.com/og.jpg' })
    expect(r).toMatchObject({
      name: 'Easy Baked Lemon Garlic Chicken Thighs', description: 'Weeknight winner.', image_url: 'https://example.com/chicken.jpg',
      servings: 4, yield_text: '4 servings', prep_time: 10, cook_time: 35, total_time: 45, source_url: 'https://example.com/post', via: 'jsonld',
    })
    expect(r.tags).toEqual(['chicken', 'easy', 'dinner', 'Main Course', 'American'])
    expect(r.instructions).toBe('Prep\n1. Preheat oven to 375°F.\n2. Pat the chicken dry.\n3. Roast 35 minutes.')
    expect(r.ingredients).toEqual([
      { section: null, name: 'chicken thighs', qty: 2, qty_text: '2', unit: 'lb', notes: 'bone-in' },
      { section: null, name: 'olive oil', qty: 3, qty_text: '3', unit: 'tbsp', notes: null },
      { section: null, name: 'chickpeas', qty: 1, qty_text: '1', unit: 'can', notes: '15 oz' },
      { section: null, name: 'Salt', qty: null, qty_text: 'to taste', unit: null, notes: null },
    ])
  })
  it('applies WordPress group hints in order and falls back to the og image', () => {
    const node = { '@type': 'Recipe', name: 'Soup', recipeIngredient: ['1 onion', '2 cups broth', '8 corn tortillas'], recipeInstructions: 'Simmer everything.' }
    const r = mapJsonLdRecipe(node, { url: 'https://x.test/soup', ogImage: 'https://x.test/og.jpg', sectionHints: [{ name: 'Soup', count: 2 }, { name: 'Crisps', count: 1 }] })
    expect(r.ingredients.map(i => i.section)).toEqual(['Soup', 'Soup', 'Crisps'])
    expect(r.image_url).toBe('https://x.test/og.jpg')
    expect(r.instructions).toBe('1. Simmer everything.')
  })
  it('returns null without a name or without ingredients', () => {
    expect(mapJsonLdRecipe({ '@type': 'Recipe', recipeIngredient: ['1 egg'] }, {})).toBeNull()
    expect(mapJsonLdRecipe({ '@type': 'Recipe', name: 'Empty' }, {})).toBeNull()
  })
})

describe('helpers', () => {
  it('converts ISO durations to minutes', () => {
    expect(isoDurationToMinutes('PT1H30M')).toBe(90)
    expect(isoDurationToMinutes('PT45M')).toBe(45)
    expect(isoDurationToMinutes('P0DT2H')).toBe(120)
    expect(isoDurationToMinutes('nope')).toBeNull()
    expect(isoDurationToMinutes(undefined)).toBeNull()
  })
  it('reads yields as a low integer plus the text', () => {
    expect(parseYield('4-6 servings')).toEqual({ servings: 4, yield_text: '4-6 servings' })
    expect(parseYield(['6', '6 servings'])).toEqual({ servings: 6, yield_text: '6 servings' })
    expect(parseYield(8)).toEqual({ servings: 8, yield_text: null })
    expect(parseYield('Makes one 9-inch pie')).toEqual({ servings: null, yield_text: 'Makes one 9-inch pie' })
    expect(parseYield(undefined)).toEqual({ servings: null, yield_text: null })
  })
})
