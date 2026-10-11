import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { keys, STALE } from '../queries/keys'
import { fetchItemHistory } from '../queries/fetchers'

const EMPTY = []

export function useItemHistory(householdId) {
  const { data: history = EMPTY } = useQuery({
    queryKey: keys.itemHistory(householdId),
    queryFn: () => fetchItemHistory(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.itemHistory,
  })

  const getSuggestions = (query) => {
    if (!query || query.length < 1) return []
    const lower = query.toLowerCase()
    return history.filter(name => name.toLowerCase().includes(lower)).slice(0, 5)
  }

  return { history, getSuggestions }
}
