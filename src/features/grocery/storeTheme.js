// Store → color role classes (docs/DESIGN_DIRECTION.md). Class strings are
// spelled out so Tailwind's scanner keeps them.
const THEMES = {
  pilgrims: { key: 'pilgrims', tile: 'bg-store-pilgrims-tile', ink: 'text-store-pilgrims-ink', ring: 'border-store-pilgrims-accent', accentBg: 'bg-store-pilgrims-accent', accentText: 'text-store-pilgrims-accent' },
  costco: { key: 'costco', tile: 'bg-store-costco-tile', ink: 'text-store-costco-ink', ring: 'border-store-costco-accent', accentBg: 'bg-store-costco-accent', accentText: 'text-store-costco-accent' },
  grocery: { key: 'grocery', tile: 'bg-store-grocery-tile', ink: 'text-store-grocery-ink', ring: 'border-store-grocery-accent', accentBg: 'bg-store-grocery-accent', accentText: 'text-store-grocery-accent' },
  other: { key: 'other', tile: 'bg-store-other-tile', ink: 'text-store-other-ink', ring: 'border-store-other-accent', accentBg: 'bg-store-other-accent', accentText: 'text-store-other-accent' },
}

export function storeLabel(store) {
  const s = typeof store === 'string' ? store.trim() : ''
  return s || 'Grocery Store'
}

function storeKey(store) {
  const s = storeLabel(store).toLowerCase()
  if (s === 'grocery store' || s === 'store') return 'grocery'
  if (s.startsWith('pilgr')) return 'pilgrims'
  if (s === 'costco') return 'costco'
  return 'other'
}

export function storeTheme(store) {
  return THEMES[storeKey(store)]
}
