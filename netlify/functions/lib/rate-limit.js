import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const noop = async () => {}

export async function recordUsage(userId, action) {
  await supabase.from('api_usage').insert({ user_id: userId, action })
}

// Count-then-insert, for a database without reserve_api_usage yet
// (sql/2026-10-19-rate-limit.sql). Parallel requests can all pass here.
async function legacyCheck(userId, action, maxPerHour, reserve) {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart)

  if (error) console.warn('rate-limit: count failed, allowing:', error.message)
  const used = count ?? 0
  if (used >= maxPerHour) return { allowed: false, remaining: 0, settle: noop }

  if (reserve) await recordUsage(userId, action)
  return {
    allowed: true,
    remaining: maxPerHour - used - (reserve ? 1 : 0),
    settle: reserve ? noop : async (ok) => { if (ok) await recordUsage(userId, action) },
  }
}

// Reserves one use of `action` for the hour, or says no. The count and the
// insert happen in one statement under a per-user lock, so parallel requests
// cannot all slip through.
//
// `reserve: false` callers count only successful work: they must call
// `settle(ok)` once the work is done. A failure gives the slot back.
export async function checkRateLimit(userId, action, maxPerHour = 10, { reserve = true } = {}) {
  const { data, error } = await supabase.rpc('reserve_api_usage', { p_user: userId, p_action: action, p_max: maxPerHour })

  if (error) {
    // PGRST202: the function is not deployed yet. Anything else, warn and use
    // the old path, which itself allows on error.
    if (error.code !== 'PGRST202') console.warn('rate-limit: reserve failed, using count:', error.message)
    return legacyCheck(userId, action, maxPerHour, reserve)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.allowed) return { allowed: false, remaining: 0, settle: noop }

  const id = row.usage_id
  return {
    allowed: true,
    remaining: Math.max(0, maxPerHour - (row.used ?? 0) - 1),
    settle: reserve || !id ? noop : async (ok) => {
      if (ok) return
      const { error: delError } = await supabase.from('api_usage').delete().eq('id', id)
      if (delError) console.warn('rate-limit: release failed:', delError.message)
    },
  }
}
