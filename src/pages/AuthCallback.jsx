import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BootScreen from '../components/BootScreen'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      navigate(session ? '/' : '/login', { replace: true })
    })
  }, [navigate])

  return <BootScreen message="Signing you in" />
}
