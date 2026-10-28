import { useEffect } from 'react'
import { getPlace } from './placesSearch'

// Places saved before the map existed have no location. Look each one up
// once per app session (one Google details call apiece, inside the free
// tier) and store it, so its pin appears. A failure is retried next session.
const tried = new Set()

export function useBackfillLocations(restaurants, setLocation) {
  useEffect(() => {
    const missing = restaurants.filter(r => r.place_id && r.lat == null && !tried.has(r.id))
    if (missing.length === 0) return
    for (const r of missing) tried.add(r.id)
    ;(async () => {
      for (const r of missing) {
        try {
          const place = await getPlace(r.place_id)
          if (place?.lat != null && place?.lng != null) await setLocation(r.id, place.lat, place.lng)
        } catch {
          // no pin this time
        }
      }
    })()
  }, [restaurants, setLocation])
}
