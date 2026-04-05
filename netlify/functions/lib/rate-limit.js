import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function checkRateLimit(userId, action, maxPerHour = 10) {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart)

  if (count >= maxPerHour) {
    return { allowed: false, remaining: 0 }
  }

  await supabase.from('api_usage').insert({
    user_id: userId,
    action,
  })

  return { allowed: true, remaining: maxPerHour - count - 1 }
}
