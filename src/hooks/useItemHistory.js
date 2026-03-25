import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useItemHistory(householdId) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!householdId) return

    const fetch = async () => {
      const { data } = await supabase
        .from('item_history')
        .select('name')
        .eq('household_id', householdId)
        .order('name')

      if (data) setHistory(data.map(d => d.name))
    }

    fetch()
  }, [householdId])

  const getSuggestions = (query) => {
    if (!query || query.length < 1) return []
    const lower = query.toLowerCase()
    return history
      .filter(name => name.toLowerCase().includes(lower))
      .slice(0, 5)
  }

  return { history, getSuggestions }
}
