import { describe, it, expect } from 'vitest'
import { looksLikeIngredientList, draftFromPastedList } from './pasteText'

const PLAIN = `2 cups flour
1 tsp salt
3 eggs
1/2 cup milk
2 tbsp butter`

const CHATGPT = `Here's a simple pancake recipe:

**Ingredients**
- 2 cups flour
- 1 tsp salt
- 3 eggs
- 1/2 cup milk

**Instructions**
1. Whisk the dry ingredients together in a large bowl.
2. Add the eggs and milk and stir until just combined.
3. Cook on a hot griddle until golden on both sides.`

const PROSE = `My grandmother used to make these pancakes every Sunday morning. She would whisk the flour with a pinch of salt, then crack in the eggs and pour the milk slowly while stirring.
Nobody has ever written down how much of anything she used.`

const BULLETS = `• **2 cups** all-purpose flour
• **1 tsp** salt
• **3** large eggs
• **½ cup** whole milk
• a pinch of nutmeg`

const STEPS_ONLY = `1. Preheat the oven to 400.
2. Mix the flour and salt.
3. Bake for 20 minutes.`

const MOSTLY_PROSE = `2 cups flour
Then you take the flour and sift it twice
and set it aside while the butter softens on the counter
1 tsp salt`

describe('looksLikeIngredientList', () => {
  it.each([
    ['a plain list', PLAIN, true],
    ['a list with bullets and bold', BULLETS, true],
    ['a ChatGPT recipe with an Instructions heading and numbered steps', CHATGPT, false],
    ['prose', PROSE, false],
    ['numbered cooking steps', STEPS_ONLY, false],
    ['a list where fewer than 60% of lines start with an amount', MOSTLY_PROSE, false],
    ['one line', '2 cups flour', false],
    ['nothing', '   \n  ', false],
  ])('%s -> %s', (_label, text, expected) => {
    expect(looksLikeIngredientList(text)).toBe(expected)
  })

  it('counts "a pinch" and "pinch of" as amounts', () => {
    expect(looksLikeIngredientList('a pinch of salt\npinch of nutmeg')).toBe(true)
  })
})

describe('draftFromPastedList', () => {
  it('turns the list into editor rows with the amount and unit as typed', () => {
    const draft = draftFromPastedList(BULLETS)
    expect(Object.keys(draft)).toEqual(['ingredients'])
    expect(draft.ingredients).toEqual([
      { name: 'all-purpose flour', qty: '2', unit: 'cups', notes: '', section: '' },
      { name: 'salt', qty: '1', unit: 'tsp', notes: '', section: '' },
      { name: 'large eggs', qty: '3', unit: '', notes: '', section: '' },
      { name: 'whole milk', qty: '½', unit: 'cup', notes: '', section: '' },
      { name: 'nutmeg', qty: 'pinch', unit: '', notes: '', section: '' },
    ])
  })

  it('keeps group headers as the section on the rows under them', () => {
    const draft = draftFromPastedList('For the sauce:\n1 cup cream\n2 tbsp butter')
    expect(draft.ingredients.map(r => r.section)).toEqual(['For the sauce', 'For the sauce'])
  })
})
