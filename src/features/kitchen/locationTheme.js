// Location → color role classes. The Kitchen page tints every tile by the
// location that is showing (docs/DESIGN_DIRECTION.md).
export const LOCATIONS = ['fridge', 'freezer', 'pantry']
export const LOCATION_LABELS = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry', home_goods: 'Home goods' }
export const KITCHEN_LAST_KEY = 'kitchen:last'

const THEMES = {
  pantry: { key: 'pantry', tile: 'bg-loc-pantry-tile', ink: 'text-loc-pantry-ink', accentBg: 'bg-loc-pantry-accent', accentText: 'text-loc-pantry-accent', ring: 'border-loc-pantry-accent', focusRing: 'focus:ring-loc-pantry-accent' },
  fridge: { key: 'fridge', tile: 'bg-loc-fridge-tile', ink: 'text-loc-fridge-ink', accentBg: 'bg-loc-fridge-accent', accentText: 'text-loc-fridge-accent', ring: 'border-loc-fridge-accent', focusRing: 'focus:ring-loc-fridge-accent' },
  freezer: { key: 'freezer', tile: 'bg-loc-freezer-tile', ink: 'text-loc-freezer-ink', accentBg: 'bg-loc-freezer-accent', accentText: 'text-loc-freezer-accent', ring: 'border-loc-freezer-accent', focusRing: 'focus:ring-loc-freezer-accent' },
  home_goods: { key: 'home_goods', tile: 'bg-loc-home-tile', ink: 'text-loc-home-ink', accentBg: 'bg-loc-home-accent', accentText: 'text-loc-home-accent', ring: 'border-loc-home-accent', focusRing: 'focus:ring-loc-home-accent' },
}

export const isLocation = (loc) => LOCATIONS.includes(loc)

export function locationTheme(location) {
  return THEMES[location] ?? THEMES.pantry
}

export function readLastLocation() {
  try {
    const v = localStorage.getItem(KITCHEN_LAST_KEY)
    return isLocation(v) ? v : 'fridge'
  } catch {
    return 'fridge'
  }
}

export function writeLastLocation(location) {
  if (!isLocation(location)) return
  try { localStorage.setItem(KITCHEN_LAST_KEY, location) } catch { /* storage unavailable */ }
}

// Which location a path is showing: /kitchen/pantry, the legacy /pantry, or
// the last-used one for a bare /kitchen.
export function locationFromPath(pathname) {
  const m = pathname.match(/^\/(?:kitchen\/)?(fridge|freezer|pantry)(?:\/|$)/)
  if (m) return m[1]
  return readLastLocation()
}
