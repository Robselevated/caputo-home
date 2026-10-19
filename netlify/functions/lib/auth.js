import { createClient } from '@supabase/supabase-js'

// A valid login is not enough: anyone can create a Supabase account with the
// public key, and the live database has no signup trigger to place them in a
// household. Only a user with a household profile may call a function, so a
// stranger cannot spend the AI budget. The profile is read with the caller's
// own token, so RLS decides what they can see.
export async function verifyAuth(event, { create = createClient } = {}) {
  const token = event.headers?.authorization?.replace('Bearer ', '')
  if (!token) return null

  const supabase = create(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

  const { data: { user } = {}, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabase.from('users').select('household_id').eq('id', user.id).maybeSingle()
  if (!profile?.household_id) return null
  return { ...user, household_id: profile.household_id }
}
