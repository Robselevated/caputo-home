import { describe, it, expect } from 'vitest'
import { errorText, friendlyDbError } from './recipeFormat'

describe('friendlyDbError', () => {
  it('turns Postgres codes into plain sentences', () => {
    expect(friendlyDbError({ code: '22P02', message: 'invalid input syntax for type numeric' })).toBe('One of the amounts is not a number we can save. Check the quantities and try again.')
    expect(friendlyDbError({ code: '23502', message: 'null value' })).toBe('The recipe needs a name.')
    expect(friendlyDbError({ code: '42501', message: 'permission denied' })).toBe('You do not have access to this recipe.')
    expect(friendlyDbError({ code: 'XX000', message: 'boom' })).toBe('Could not save the recipe. Try again.')
  })
  it('errorText never shows raw database text', () => {
    expect(errorText({ code: '22P02', message: 'invalid input syntax for type numeric' }, 'fallback')).toBe('One of the amounts is not a number we can save. Check the quantities and try again.')
    expect(errorText('plain words', 'fallback')).toBe('plain words')
    expect(errorText({ message: 'Request timed out.' }, 'fallback')).toBe('Request timed out.')
    expect(errorText(null, 'fallback')).toBe('fallback')
  })
})
