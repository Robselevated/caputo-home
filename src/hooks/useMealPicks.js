import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { upsertById, removeById } from '../lib/realtimeCache'
import { keys, STALE } from '../queries/keys'
import { fetchMealPicks } from '../queries/fetchers'
import { insertMealPick, updateMealPick, deleteMealPick, deleteMealPicks } from '../queries/writes'
import { resolveSection } from '../lib/mealSections'

const EMPTY = []
const oldestFirst = (rows) => [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
// Postgres unique violation: meal_picks_one_per_day already has a pick that day.
const DAY_TAKEN = '23505'
const dayTakenToast = () => toast({ message: 'That day already has a meal', tone: 'error' })

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

  // `plannedFor` (YYYY-MM-DD) puts the new pick straight onto a calendar day.
  const addPick = async ({ userId, recipeId, name, notes, imageUrl, section, plannedFor }) => {
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
      // Only sent when set, so adding to a list never names the column.
      ...(plannedFor ? { planned_for: plannedFor } : {}),
    }
    await qc.cancelQueries({ queryKey: key })
    setAll(prev => oldestFirst([...prev, { ...row, created_at: new Date().toISOString() }]))
    try {
      const saved = await insertMealPick(supabase, row)
      if (saved) setAll(prev => oldestFirst(upsertById(prev, saved)))
      return { error: null }
    } catch (error) {
      setAll(prev => removeById(prev, row.id))
      if (error?.code === DAY_TAKEN) dayTakenToast()
      else toast({ message: `Couldn't add ${row.name} to the plan`, tone: 'error' })
      return { error }
    }
  }

  // Move a pick onto a day (YYYY-MM-DD) or back to its list (null).
  const schedulePick = async (id, plannedFor) => {
    await qc.cancelQueries({ queryKey: key })
    const prevRow = (snapshot() ?? []).find(p => p.id === id)
    if (!prevRow) return { error: 'Not found' }
    const planned_for = plannedFor || null
    setAll(prev => prev.map(p => (p.id === id ? { ...p, planned_for } : p)))
    try {
      const saved = await updateMealPick(supabase, id, { planned_for })
      if (saved) setAll(prev => oldestFirst(upsertById(prev, saved)))
      return { error: null }
    } catch (error) {
      setAll(prev => prev.map(p => (p.id === id ? { ...p, planned_for: prevRow.planned_for ?? null } : p)))
      if (error?.code === DAY_TAKEN) dayTakenToast()
      else toast({ message: `Couldn't move ${prevRow.name}`, tone: 'error' })
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
    // (which display under a default section) are cleared too. Picks already
    // on the calendar are not in the list, so Clear leaves them alone.
    const removed = (snapshot() ?? []).filter(p => !p.planned_for && resolveSection(p.section) === sectionName)
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

  return { picks, loading: isPending, addPick, schedulePick, removePick, clearSection }
}
