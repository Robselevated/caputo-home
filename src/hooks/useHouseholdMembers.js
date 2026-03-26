import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useHouseholdMembers(householdId) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('household_id', householdId)
      .order('name')

    if (!error && data) setMembers(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    fetchMembers()
  }, [householdId, fetchMembers])

  return { members, loading }
}
