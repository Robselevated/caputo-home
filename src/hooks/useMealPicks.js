import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { upsertById, removeById } from '../lib/realtimeCache'
import { keys, STALE } from '../queries/keys'
import { fetchMealPicks } from '../queries/fetchers'
import { insertMealPick, deleteMealPick, deleteMealPicks } from '../queries/writes'
import { resolveSection } from '../lib/mealSections'

const EMPTY = []
const oldestFirst = (rows) => [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))

export function useMealPicks(householdId) {
  const qc = useQueryClient()
  const key = keys.mealPicks(householdId)

  const { data: picks = EMPTY, isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchMealPicks(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.mealPicks,
  })

  const setAll = (updater) => qc.setQueryData(key, (prev) => updater(prev ?? []))
  const snapshot = () => qc.getQueryData(key)

  const addPick = async ({ userId, recipeId, name, notes, imageUrl, section }) => {
    if (!householdId) return { error: 'No household' }
    const row = {
      id: crypto.randomUUID(),
      household_id: householdId,
      user_id: userId,
      recipe_id: recipeId || null,
      name: name.trim(),
      notes: notes?.trim() || null,
      image_url: imageUrl || null,
      section: section || null,
    }
    await qc.cancelQueries({ queryKey: key })
    setAll(prev => oldestFirst([...prev, { ...row, created_at: new Date().toISOString() }]))
    try {
      const saved = await insertMealPick(supabase, row)
      if (saved) setAll(prev => oldestFirst(upsertById(prev, saved)))
      return { error: null }
    } catch (error) {
      setAll(prev => removeById(prev, row.id))
      toast({ message: `Couldn't add ${row.name} to the plan`, tone: 'error' })
      return { error }
    }
  }

  const removePick = async (id) => {
    await qc.cancelQueries({ queryKey: key })
    const prevRow = (snapshot() ?? []).find(p => p.id === id)
    setAll(prev => removeById(prev, id))
    try {
      await deleteMealPick(supabase, id)
      return { error: null }
    } catch (error) {
      if (prevRow) setAll(prev => oldestFirst(upsertById(prev, prevRow)))
      toast({ message: "Couldn't remove that pick", tone: 'error' })
      return { error }
    }
  }

  const clearSection = async (sectionName) => {
    await qc.cancelQueries({ queryKey: key })
    // Same grouping the page renders with, so null and legacy section names
    // (which display under a default section) are cleared too.
    const removed = (snapshot() ?? []).filter(p => resolveSection(p.section) === sectionName)
    const ids = new Set(removed.map(p => p.id))
    setAll(prev => prev.filter(p => !ids.has(p.id)))
    try {
      await deleteMealPicks(supabase, householdId, [...ids])
      return { error: null }
    } catch (error) {
      setAll(prev => oldestFirst(removed.reduce((acc, row) => upsertById(acc, row), prev)))
      toast({ message: `Couldn't clear ${sectionName}`, tone: 'error' })
      return { error }
    }
  }

  return { picks, loading: isPending, addPick, removePick, clearSection }
}
