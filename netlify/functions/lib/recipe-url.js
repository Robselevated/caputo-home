import { createDeadline, TimeoutError } from './budget.js'
import { callModel, extractJson } from './anthropicClient.js'
import { fetchContent, isPublicHttpUrl } from './fetchPage.js'
import { blockedReason, blockedMessage } from './blockedSites.js'
import { isPinterestUrl, resolvePin } from './pinterest.js'
import { findRecipeNode, mapJsonLdRecipe } from './jsonld.js'
import { htmlToText, recipeWindow, sectionHints, extractOgImage } from './htmlText.js'
import { RECIPE_TEXT_PROMPT } from './prompts.js'
import { normalizeContract, reply, errorStatus, NO_RECIPE, NO_INGREDIENTS, TOO_LONG, UNREADABLE } from './contract.js'

// Link -> recipe. Structured data first (no model), the model only for
// pages without it, Pinterest resolved to its source page.
export async function parseRecipeFromUrl(inputUrl, deps = {}) {
  const { fetchImpl = globalThis.fetch, client = null, deadline = createDeadline(), firecrawlKey = process.env.FIRECRAWL_API_KEY } = deps
  let url = String(inputUrl || '').trim()

  const viaModel = async (text, { via, sourceUrl, fallbackImage }) => {
    if (!client) return reply(422, { error: NO_RECIPE })
    const { text: out, stop_reason } = await callModel(client, { system: RECIPE_TEXT_PROMPT, messages: [{ role: 'user', content: text }], max_tokens: 4096 }, deadline)
    const raw = extractJson(out)
    if (!raw) return reply(422, { error: stop_reason === 'max_tokens' ? TOO_LONG : NO_RECIPE })
    const recipe = normalizeContract(raw, { sourceUrl, via, fallbackImage })
    if (!recipe.name && recipe.ingredients.length === 0) return reply(422, { error: NO_RECIPE })
    if (recipe.ingredients.length === 0) return reply(422, { error: NO_INGREDIENTS })
    return reply(200, recipe)
  }

  try {
    if (!isPublicHttpUrl(url)) return reply(400, { error: 'That link does not look right. Check it and try again.' })
    const blocked = blockedReason(url)
    if (blocked) return reply(422, { error: blocked, code: 'blocked' })

    let fallbackImage = null
    if (isPinterestUrl(url)) {
      const pin = await resolvePin(url, { fetchImpl, signal: deadline.signal(8000) })
      if (pin?.link && isPublicHttpUrl(pin.link)) {
        const b2 = blockedReason(pin.link)
        if (b2) return reply(422, { error: b2, code: 'blocked' })
        url = pin.link
        fallbackImage = pin.imageUrl
      } else if (pin?.description) {
        const text = [pin.title, pin.description].filter(Boolean).join('\n')
        return await viaModel(text, { via: 'pinterest', sourceUrl: String(inputUrl).trim(), fallbackImage: pin.imageUrl })
      } else {
        return reply(422, { error: 'That pin does not link to a recipe page and has no recipe text. Open the pin, copy the recipe, and use Paste.' })
      }
    }

    const page = await fetchContent(url, deadline, { fetchImpl, firecrawlKey })
    const ogImage = extractOgImage(page.html) || fallbackImage
    const node = findRecipeNode(page.html)
    const mapped = node ? mapJsonLdRecipe(node, { url: page.finalUrl, ogImage, sectionHints: sectionHints(page.html) }) : null
    if (mapped) return reply(200, mapped)
    if (deadline.expired) throw new TimeoutError('budget')
    const text = recipeWindow(htmlToText(page.html))
    return await viaModel(text, { via: 'model', sourceUrl: page.finalUrl, fallbackImage: ogImage })
  } catch (err) {
    if (err?.code === 'blocked') {
      let host = url
      try { host = new URL(url).hostname.replace(/^www\./, '') } catch { /* keep as is */ }
      return reply(422, { error: blockedMessage(host), code: 'blocked' })
    }
    const known = errorStatus(err)
    if (known) return known
    console.error('parse-recipe:', String(err?.message || err).split('\n')[0])
    return reply(502, { error: UNREADABLE })
  }
}
