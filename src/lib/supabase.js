import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auto-sign-in so RLS policies pass on all devices
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    supabase.auth.signInWithPassword({
      email: 'caputo-home@family.local',
      password: '123456',
    })
  }
})
