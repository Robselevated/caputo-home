import { createDeadline } from './budget.js'
import { callModel, extractJson } from './anthropicClient.js'
import { RECIPE_TEXT_PROMPT } from './prompts.js'
import { normalizeContract, reply, errorStatus, NO_RECIPE_TEXT as NO_RECIPE, NO_INGREDIENTS_TEXT as NO_INGREDIENTS, TOO_LONG, UNREADABLE } from './contract.js'

// Longer than any recipe, shorter than a model window: a whole blog post with
// its comments still fits, a pasted cookbook does not.
export const MAX_TEXT_CHARS = 30000
export const EMPTY_TEXT = 'Paste some recipe text first.'

// Pasted text -> recipe, one model call. The caller decides whether the text
// even needs the model (a plain ingredient list is parsed on the phone).
export async function parseRecipeFromText(input, deps = {}) {
  const { client = null, deadline = createDeadline() } = deps
  const text = String(input ?? '').trim()
  if (!text) return reply(400, { error: EMPTY_TEXT })
  if (text.length > MAX_TEXT_CHARS) return reply(422, { error: TOO_LONG })
  if (!client) return reply(502, { error: UNREADABLE })

  try {
    const { text: out, stop_reason } = await callModel(client, { system: RECIPE_TEXT_PROMPT, messages: [{ role: 'user', content: text }], max_tokens: 4096 }, deadline)
    const raw = extractJson(out)
    if (!raw) return reply(422, { error: stop_reason === 'max_tokens' ? TOO_LONG : NO_RECIPE })
    const recipe = normalizeContract(raw, { via: 'text' })
    if (recipe.ingredients.length === 0) {
      // A reply cut off before its first row was too long, not an empty recipe.
      if (stop_reason === 'max_tokens') return reply(422, { error: TOO_LONG })
      return reply(422, { error: recipe.name ? NO_INGREDIENTS : NO_RECIPE })
    }
    return reply(200, recipe)
  } catch (err) {
    const known = errorStatus(err)
    if (known) return known
    console.error('parse-recipe-text:', String(err?.message || err).split('\n')[0])
    return reply(502, { error: UNREADABLE })
  }
}
