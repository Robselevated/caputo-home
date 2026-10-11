import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { keys, STALE } from '../queries/keys'
import { fetchMembers } from '../queries/fetchers'

const EMPTY = []

export function useHouseholdMembers(householdId) {
  const { data: members = EMPTY, isPending } = useQuery({
    queryKey: keys.members(householdId),
    queryFn: () => fetchMembers(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.members,
  })
  return { members, loading: isPending }
}
