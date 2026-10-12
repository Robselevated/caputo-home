import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function recordUsage(userId, action) {
  await supabase.from('api_usage').insert({ user_id: userId, action })
}

// `reserve: false` lets a caller count only successful work (recordUsage on
// success), so a failed import does not eat the hourly allowance.
export async function checkRateLimit(userId, action, maxPerHour = 10, { reserve = true } = {}) {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart)

  if (error) console.warn('rate-limit: count failed, allowing:', error.message)
  const used = count ?? 0
  if (used >= maxPerHour) return { allowed: false, remaining: 0 }

  if (reserve) await recordUsage(userId, action)
  return { allowed: true, remaining: maxPerHour - used - (reserve ? 1 : 0) }
}
