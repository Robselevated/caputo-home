import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { upsertById, removeById } from '../lib/realtimeCache'
import { keys, STALE } from '../queries/keys'
import { fetchRestaurants, fetchRestaurantRatings, fetchRestaurantNotes } from '../queries/fetchers'
import {
  insertRestaurant, updateRestaurant, deleteRestaurant, setRestaurantSortOrder,
  upsertRestaurantRating, deleteRestaurantRating, insertRestaurantNote, updateRestaurantNote, deleteRestaurantNote,
} from '../queries/writes'

const EMPTY = []

export const byOrder = (rows) => [...rows].sort((a, b) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
const oldestFirst = (rows) => [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))

// The two people who score a date. Ratings are keyed by these, not by login,
// so either of us can fill in both.
export const PEOPLE = [
  { key: 'rob', label: 'Rob' },
  { key: 'cheyene', label: 'Cheyene' },
]

// Score entry without a decimal key: the last digit is the tenths, so 97
// reads 9.7 and 100 reads 10.0. Anything that isn't a digit is ignored.
// Returns the digits to keep, or null when the keystroke should be refused.
export function scoreDigits(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length <= 2) return digits
  return digits === '100' ? digits : null
}

export function formatScoreDigits(digits) {
  if (!digits) return ''
  if (digits.length === 1) return digits
  return `${digits.slice(0, -1)}.${digits.slice(-1)}`
}

// A saved score back to entry digits: 9.7 -> '97', 9 -> '90', 10 -> '100'.
export const scoreToDigits = (score) => (score == null ? '' : String(Math.round(Number(score) * 10)))

// Scores are 0 to 10 in tenths. Returns null for anything else.
export function parseScore(input) {
  const text = String(input ?? '').trim().replace(',', '.')
  if (!/^\d{1,2}(\.\d)?$/.test(text)) return null
  const n = Number(text)
  return n >= 0 && n <= 10 ? n : null
}

export function averageScore(ratings) {
  if (!ratings?.length) return null
  const sum = ratings.reduce((acc, r) => acc + Number(r.score), 0)
  return Math.round((sum / ratings.length) * 10) / 10
}

// Date Night on the shared query cache: restaurants, each person's score, and
// bullet notes. Writes are optimistic and roll back with a toast on failure;
// realtime patches arrive through RealtimeProvider.
export function useRestaurants(householdId) {
  const qc = useQueryClient()
  const rKey = keys.restaurants(householdId)
  const sKey = keys.restaurantRatings(householdId)
  const nKey = keys.restaurantNotes(householdId)
  const enabled = !!householdId

  const { data: restaurants = EMPTY, isPending } = useQuery({
    queryKey: rKey, queryFn: () => fetchRestaurants(supabase, householdId), enabled, staleTime: STALE.restaurants,
  })
  const { data: ratings = EMPTY } = useQuery({
    queryKey: sKey, queryFn: () => fetchRestaurantRatings(supabase, householdId), enabled, staleTime: STALE.restaurants,
  })
  const { data: notes = EMPTY } = useQuery({
    queryKey: nKey, queryFn: () => fetchRestaurantNotes(supabase, householdId), enabled, staleTime: STALE.restaurants,
  })

  const setList = (key, updater) => qc.setQueryData(key, (prev) => updater(prev ?? []))
  const find = (id) => (qc.getQueryData(rKey) ?? []).find(r => r.id === id)

  const addRestaurant = async (place, userId) => {
    if (!householdId) return { error: 'No household' }
    const current = qc.getQueryData(rKey) ?? []
    const existing = current.find(r => r.place_id === place.placeId)
    if (existing) {
      toast({ message: existing.status === 'archived' ? `${existing.name} is already in Been there` : `${existing.name} is already on the list` })
      return { error: 'duplicate' }
    }
    const listed = current.filter(r => r.status === 'list')
    const row = {
      id: crypto.randomUUID(),
      household_id: householdId,
      place_id: place.placeId,
      name: place.name,
      cuisine: place.cuisine || null,
      address: place.address || null,
      maps_url: place.mapsUrl || null,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      status: 'list',
      sort_order: listed.reduce((max, r) => Math.max(max, r.sort_order ?? 0), -1) + 1,
      created_by: userId ?? null,
    }
    await qc.cancelQueries({ queryKey: rKey })
    setList(rKey, prev => byOrder([...prev, { ...row, created_at: new Date().toISOString() }]))
    try {
      const saved = await insertRestaurant(supabase, row)
      if (saved) setList(rKey, prev => byOrder(upsertById(prev, saved)))
      return { error: null }
    } catch (error) {
      setList(rKey, prev => removeById(prev, row.id))
      toast({ message: `Couldn't save ${row.name}`, tone: 'error' })
      return { error }
    }
  }

  const patch = async (id, changes, failMessage) => {
    const prevRow = find(id)
    if (!prevRow) return { error: 'Not found' }
    await qc.cancelQueries({ queryKey: rKey })
    setList(rKey, prev => byOrder(upsertById(prev, { ...prevRow, ...changes })))
    try {
      await updateRestaurant(supabase, id, changes)
      return { error: null }
    } catch (error) {
      setList(rKey, prev => byOrder(upsertById(prev, prevRow)))
      toast({ message: failMessage, tone: 'error' })
      return { error }
    }
  }

  // "We went": off the list, into Been there, stamped with today.
  const markVisited = (id) => patch(id, { status: 'archived', visited_at: new Date().toISOString() }, "Couldn't move it to Been there")

  // Back to the bottom of the list to go again. The visit date and scores stay.
  const moveToList = (id) => {
    const listed = (qc.getQueryData(rKey) ?? []).filter(r => r.status === 'list')
    const bottom = listed.reduce((max, r) => Math.max(max, r.sort_order ?? 0), -1) + 1
    return patch(id, { status: 'list', sort_order: bottom }, "Couldn't move it back to the list")
  }

  // Quiet: fills map pins for places saved before locations were stored, and
  // a miss just means no pin until the next try.
  const setLocation = async (id, lat, lng) => {
    setList(rKey, prev => prev.map(r => (r.id === id ? { ...r, lat, lng } : r)))
    try {
      await updateRestaurant(supabase, id, { lat, lng })
      return { error: null }
    } catch (error) {
      setList(rKey, prev => prev.map(r => (r.id === id ? { ...r, lat: null, lng: null } : r)))
      return { error }
    }
  }

  const reorder = async (orderedIds) => {
    await qc.cancelQueries({ queryKey: rKey })
    const snap = qc.getQueryData(rKey)
    const positions = new Map(orderedIds.map((id, idx) => [id, idx]))
    setList(rKey, prev => byOrder(prev.map(r => (positions.has(r.id) ? { ...r, sort_order: positions.get(r.id) } : r))))
    try {
      await setRestaurantSortOrder(supabase, orderedIds)
      return { error: null }
    } catch (error) {
      if (snap) qc.setQueryData(rKey, snap)
      toast({ message: "Couldn't save the new order", tone: 'error' })
      return { error }
    }
  }

  const removeRestaurant = async (id) => {
    const prevRow = find(id)
    await qc.cancelQueries({ queryKey: rKey })
    setList(rKey, prev => removeById(prev, id))
    try {
      await deleteRestaurant(supabase, id)
      return { error: null }
    } catch (error) {
      if (prevRow) setList(rKey, prev => byOrder(upsertById(prev, prevRow)))
      toast({ message: "Couldn't remove that restaurant", tone: 'error' })
      return { error }
    }
  }

  // score null clears that person's score. userId records who typed it.
  const setRating = async (restaurantId, person, score, userId) => {
    if (!householdId) return { error: 'No household' }
    const same = (r) => r.restaurant_id === restaurantId && r.person === person
    const snap = qc.getQueryData(sKey)
    await qc.cancelQueries({ queryKey: sKey })
    setList(sKey, prev => {
      const rest = prev.filter(r => !same(r))
      return score == null ? rest : [...rest, { restaurant_id: restaurantId, person, user_id: userId ?? null, household_id: householdId, score }]
    })
    try {
      if (score == null) await deleteRestaurantRating(supabase, restaurantId, person)
      else await upsertRestaurantRating(supabase, { restaurant_id: restaurantId, person, user_id: userId ?? null, household_id: householdId, score })
      return { error: null }
    } catch (error) {
      if (snap) qc.setQueryData(sKey, snap)
      toast({ message: "Couldn't save that score", tone: 'error' })
      return { error }
    }
  }

  const addNote = async (restaurantId, userId, body) => {
    const text = body.trim()
    if (!householdId || !text) return { error: 'Empty' }
    const row = { id: crypto.randomUUID(), restaurant_id: restaurantId, household_id: householdId, user_id: userId ?? null, body: text }
    await qc.cancelQueries({ queryKey: nKey })
    setList(nKey, prev => oldestFirst([...prev, { ...row, created_at: new Date().toISOString() }]))
    try {
      const saved = await insertRestaurantNote(supabase, row)
      if (saved) setList(nKey, prev => oldestFirst(upsertById(prev, saved)))
      return { error: null }
    } catch (error) {
      setList(nKey, prev => removeById(prev, row.id))
      toast({ message: "Couldn't save that note", tone: 'error' })
      return { error }
    }
  }

  // An emptied note is deleted rather than saved blank.
  const editNote = async (id, body) => {
    const text = body.trim()
    if (!text) return removeNote(id)
    const prevRow = (qc.getQueryData(nKey) ?? []).find(n => n.id === id)
    if (!prevRow || prevRow.body === text) return { error: null }
    await qc.cancelQueries({ queryKey: nKey })
    setList(nKey, prev => upsertById(prev, { ...prevRow, body: text }))
    try {
      await updateRestaurantNote(supabase, id, text)
      return { error: null }
    } catch (error) {
      setList(nKey, prev => upsertById(prev, prevRow))
      toast({ message: "Couldn't save that note", tone: 'error' })
      return { error }
    }
  }

  const removeNote = async (id) => {
    const prevRow = (qc.getQueryData(nKey) ?? []).find(n => n.id === id)
    await qc.cancelQueries({ queryKey: nKey })
    setList(nKey, prev => removeById(prev, id))
    try {
      await deleteRestaurantNote(supabase, id)
      return { error: null }
    } catch (error) {
      if (prevRow) setList(nKey, prev => oldestFirst(upsertById(prev, prevRow)))
      toast({ message: "Couldn't delete that note", tone: 'error' })
      return { error }
    }
  }

  return {
    restaurants, ratings, notes, loading: isPending,
    addRestaurant, markVisited, moveToList, reorder, setLocation, removeRestaurant, setRating, addNote, editNote, removeNote,
  }
}
