import Anthropic from '@anthropic-ai/sdk'
import { TimeoutError } from './budget.js'

// Haiku 4.5 reads recipes as well as Sonnet in our tests at about twice the
// speed; it does not take the beta effort flag, so only the stable call is used.
export const MODEL = 'claude-haiku-4-5-20251001'

export function makeClient(apiKey = process.env.CLAUDE_API_KEY) {
  // No silent retries: a retried 8s timeout is what used to turn one slow
  // call into a 54s failure.
  return new Anthropic({ apiKey, maxRetries: 0 })
}

// `model` is for the probe script's before/after comparisons; handlers use MODEL.
export async function callModel(client, { system, messages, max_tokens = 4096, model = MODEL }, deadline) {
  const left = deadline.remaining()
  if (left < 3000) throw new TimeoutError('model')
  const timeout = Math.min(Math.max(left - 1500, 1000), 40000)
  const res = await client.messages.create(
    { model, max_tokens, ...(system ? { system } : {}), messages },
    { timeout }
  )
  const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
  return { text, stop_reason: res.stop_reason }
}

// Close whatever the model left open: trailing commas, an unterminated
// string, unbalanced brackets (a cut-off reply still yields its rows).
export function repairJson(s) {
  let out = s.replace(/,\s*([}\]])/g, '$1')
  let inStr = false
  let esc = false
  const stack = []
  for (const ch of out) {
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  if (inStr) out += '"'
  out = out.replace(/,\s*$/, '').replace(/:\s*$/, ': null')
  while (stack.length) out += stack.pop()
  return out.replace(/,\s*([}\]])/g, '$1')
}

export function extractJson(text) {
  if (!text) return null
  const s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const tryParse = (x) => { try { const v = JSON.parse(x); return v && typeof v === 'object' ? v : null } catch { return null } }
  const direct = tryParse(s)
  if (direct) return direct
  const first = s.indexOf('{')
  if (first === -1) return null
  const last = s.lastIndexOf('}')
  const core = last > first ? s.slice(first, last + 1) : s.slice(first)
  return tryParse(core) || tryParse(repairJson(s.slice(first))) || tryParse(repairJson(core))
}
