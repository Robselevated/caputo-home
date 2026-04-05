import { createClient } from '@supabase/supabase-js'

export async function verifyAuth(event) {
  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return null

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}
