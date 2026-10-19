import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { keys, STALE } from '../queries/keys'
import { fetchRecentlyBought } from '../queries/fetchers'
import { addGroceryRows } from '../queries/groceryAdd'

const EMPTY = []

export function useRecentlyBought(householdId) {
  const qc = useQueryClient()

  const { data: items = EMPTY, isPending } = useQuery({
    queryKey: keys.recentlyBought(householdId),
    queryFn: () => fetchRecentlyBought(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.recentlyBought,
  })

  // Put a bought item back on the grocery list (optimistic on the grocery cache).
  const addBackToList = async (item, userId) => {
    const { error } = await addGroceryRows(qc, supabase, householdId, [{
      household_id: householdId,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      store: item.store,
      notes: item.notes,
      checked: false,
      added_by: userId,
      updated_by: userId,
    }])
    if (error) toast({ message: `Couldn't add ${item.name} back`, tone: 'error' })
    else toast({ message: `${item.name} is back on the list` })
    return { error }
  }


  return { items, loading: isPending, addBackToList }
}
