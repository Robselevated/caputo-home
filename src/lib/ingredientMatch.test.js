import { describe, it, expect } from 'vitest'
import { namesMatch, matchScore, matchTokens, findMatch, hasMatch, cleanGroceryName } from './ingredientMatch'

describe('namesMatch: the four false positives from the audit', () => {
  it.each([
    ['ham', 'graham crackers'],
    ['graham crackers', 'ham'],
    ['rice vinegar', 'rice'],
    ['rice', 'rice vinegar'],
    ['chili oil', 'oil'],
    ['chili oil', 'olive oil'],
    ['Salt and pepper to taste', 'Salt'],
    ['Salt', 'Salt and pepper to taste'],
    ['salt and pepper', 'black pepper'],
  ])('%s does not match %s', (a, b) => {
    expect(namesMatch(a, b)).toBe(false)
  })
})

describe('namesMatch: what still has to match', () => {
  it.each([
    ['Rice', 'rice'],
    ['flour', 'All-Purpose Flour'],
    ['black pepper', 'Freshly Ground Black Pepper'],
    ['chicken thighs', 'boneless chicken thighs'],
    ['boneless, skinless chicken thighs', 'chicken thighs'],
    ['olive oil', 'extra virgin olive oil'],
    ['cherry tomatoes', 'ripe cherry tomatoes'],
    ['ripe cherry tomatoes', 'cherry tomatoes'],
    ['jalapeño', 'Jalapeño'],
    ['lemon (zested)', 'lemon'],
  ])('%s matches %s', (a, b) => {
    expect(namesMatch(a, b)).toBe(true)
  })

  it('needs the head noun to agree for the subset rule', () => {
    expect(namesMatch('chicken thighs', 'chicken thigh fillets')).toBe(false)
    expect(namesMatch('cherry tomatoes', 'cherry tomato sauce')).toBe(false)
  })

  it('a single-token name matches only exactly or by alias', () => {
    expect(namesMatch('pepper', 'black pepper')).toBe(true)
    expect(namesMatch('pepper', 'bell pepper')).toBe(false)
    expect(namesMatch('fresh', 'fresh basil')).toBe(false)
    expect(namesMatch('fresh', 'fresh')).toBe(true)
  })
})

describe('plural folding', () => {
  it.each([
    ['eggs', 'egg'],
    ['tomatoes', 'tomato'],
    ['potatoes', 'potato'],
    ['berries', 'berry'],
    ['peaches', 'peach'],
    ['radishes', 'radish'],
    ['chicken breasts', 'chicken breast'],
    ['garlic cloves', 'garlic clove'],
    ['molasses', 'molasses'],
    ['asparagus', 'asparagus'],
  ])('%s is %s', (a, b) => {
    expect(namesMatch(a, b)).toBe(true)
  })

  it('does not fold short words or words ending in ss or us', () => {
    expect(matchTokens('gas')).toEqual(['gas'])
    expect(matchTokens('glass')).toEqual(['glass'])
    expect(matchTokens('hummus')).toEqual(['hummus'])
    expect(matchTokens('peas')).toEqual(['pea'])
  })
})

describe('aliases', () => {
  it.each([
    ['scallions', 'green onions'],
    ['green onion', 'scallion'],
    ['cilantro', 'coriander'],
    ['garlic cloves', 'garlic'],
    ['garlic', 'garlic cloves'],
    ['heavy cream', 'heavy whipping cream'],
    ['parmesan', 'parmesan cheese'],
    ['corn starch', 'cornstarch'],
    ['scallions', 'fresh green onions'],
  ])('%s matches %s', (a, b) => {
    expect(namesMatch(a, b)).toBe(true)
  })
})

describe('qualifiers that carry meaning', () => {
  it.each([
    ['brown sugar', 'white sugar'],
    ['white sugar', 'brown sugar'],
    ['dark chocolate chips', 'white chocolate chips'],
    ['ground beef', 'ground turkey'],
  ])('%s does not match %s', (a, b) => {
    expect(namesMatch(a, b)).toBe(false)
  })

  it.each([
    ['white sugar', 'sugar'],
    ['ground beef', 'beef'],
    ['brown sugar', 'brown sugar'],
    ['ground cumin', 'cumin'],
  ])('%s matches %s', (a, b) => {
    expect(namesMatch(a, b)).toBe(true)
  })
})

describe('normalisation guards', () => {
  it('never strips the last remaining word', () => {
    expect(matchTokens('Fresh')).toEqual(['fresh'])
    expect(matchTokens('Ground')).toEqual(['ground'])
    expect(matchTokens('extra virgin')).toEqual(['virgin'])
    expect(matchTokens('Freshly Ground Black Pepper')).toEqual(['black', 'pepper'])
    expect(matchTokens('All-Purpose Flour')).toEqual(['flour'])
  })

  it('a name that normalises to nothing matches nothing', () => {
    const inventory = [{ id: 'a', name: 'rice', qty: 1 }, { id: 'b', name: '', qty: 1 }]
    for (const empty of ['', '   ', '()', '(optional)', 'to taste', null, undefined]) {
      expect(matchTokens(empty)).toEqual([])
      expect(findMatch(empty, inventory)).toBeNull()
      expect(hasMatch(empty, new Set(['rice', '']))).toBe(false)
      expect(namesMatch('rice', empty)).toBe(false)
    }
    expect(findMatch('rice', inventory)).toEqual(inventory[0])
  })
})

describe('matchScore and findMatch', () => {
  it('scores exact above alias above subset', () => {
    expect(matchScore('chicken thighs', 'chicken thighs')).toBe(3)
    expect(matchScore('scallions', 'green onions')).toBe(2)
    expect(matchScore('chicken thighs', 'free range chicken thighs')).toBe(1)
    expect(matchScore('ham', 'graham crackers')).toBe(0)
  })

  it('prefers the exact candidate over an earlier subset candidate', () => {
    const inventory = [
      { id: 'a', name: 'free range chicken thighs', qty: 2 },
      { id: 'b', name: 'chicken thighs', qty: 2 },
    ]
    expect(findMatch('chicken thighs', inventory)?.id).toBe('b')
  })

  it('prefers the alias candidate over an earlier subset candidate', () => {
    const inventory = [
      { id: 'a', name: 'spring green onions', qty: 2 },
      { id: 'b', name: 'scallions', qty: 2 },
    ]
    expect(findMatch('green onions', inventory)?.id).toBe('b')
  })

  it('prefers the candidate with stock when the scores tie', () => {
    const inventory = [
      { id: 'a', name: 'sugar', qty: 0 },
      { id: 'b', name: 'white sugar', qty: 2 },
    ]
    expect(findMatch('sugar', inventory)?.id).toBe('b')
  })

  it('keeps inventory order when score and stock tie', () => {
    const inventory = [
      { id: 'a', name: 'sugar', qty: 1 },
      { id: 'b', name: 'white sugar', qty: 2 },
    ]
    expect(findMatch('sugar', inventory)?.id).toBe('a')
  })

  it('still finds a raw case-insensitive match and returns null for none', () => {
    const inventory = [{ id: 'a', name: 'Ground Beef', qty: 2 }]
    expect(findMatch('ground beef', inventory)?.id).toBe('a')
    expect(findMatch('ground turkey', inventory)).toBeNull()
    expect(findMatch('ground beef', [])).toBeNull()
  })

  it('hasMatch works against a set of lowercased inventory names', () => {
    const names = new Set(['rice', 'all-purpose flour', 'graham crackers', 'green onions'])
    expect(hasMatch('flour', names)).toBe(true)
    expect(hasMatch('scallions', names)).toBe(true)
    expect(hasMatch('Rice', names)).toBe(true)
    expect(hasMatch('ham', names)).toBe(false)
    expect(hasMatch('rice vinegar', names)).toBe(false)
  })
})

describe('cleanGroceryName', () => {
  it.each([
    ['(15 oz) can diced tomatoes', 'diced tomatoes'],
    ['2 cups flour', 'flour'],
    ['1/2 lb ground beef', 'ground beef'],
    ['1 1/2 tsp. vanilla extract', 'vanilla extract'],
    ['½ cup sugar', 'sugar'],
    ['3-4 cloves garlic', 'garlic'],
    ['cup of rice', 'rice'],
    ['fl oz heavy cream', 'heavy cream'],
    ['eggs (large)', 'eggs'],
    ['Salt,', 'Salt'],
    ['Kidney beans', 'Kidney beans'],
    ['  limes  ', 'limes'],
    ['2x chicken breasts', 'chicken breasts'],
  ])('%s becomes %s', (input, expected) => {
    expect(cleanGroceryName(input)).toBe(expected)
  })

  it('drops names that are only an amount, unit or parenthetical', () => {
    for (const empty of ['', '   ', '(optional)', '2', '2 cups', 'cups', null, undefined]) {
      expect(cleanGroceryName(empty)).toBe('')
    }
  })

  describe('a single word against a variety of the same thing', () => {
    it.each([
      ['onion', 'yellow onion', true], ['onions', 'red onion', true], ['tomatoes', 'roma tomatoes', true], ['potatoes', 'baby potatoes', true],
      ['yellow onion', 'onion', true], ['oil', 'chili oil', false], ['rice', 'rice vinegar', false], ['chicken', 'chicken thighs', false],
      ['ham', 'graham crackers', false], ['potato', 'sweet potato', false],
    ])('%s vs %s -> %s', (a, b, expected) => {
      expect(namesMatch(a, b)).toBe(expected)
    })
  })

  describe('products that merely share a word', () => {
    it('does not let green onions stand in for onions, or sugar for brown sugar', () => {
      expect(namesMatch('onion', 'green onion')).toBe(false)
      expect(namesMatch('sugar', 'brown sugar')).toBe(false)
      expect(namesMatch('brown sugar', 'sugar')).toBe(false)
      expect(findMatch('onion', [{ name: 'Green onions', qty: 3 }, { name: 'Yellow onion', qty: 2 }])?.name).toBe('Yellow onion')
    })
  })
})

