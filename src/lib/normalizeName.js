// Mirrors the Postgres generated column on inventory_items.name_key:
//   lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))
// Keep these two in lockstep: the client uses it to find the row a merge will
// hit before the server round trip completes.
export function normalizeName(s) {
  if (typeof s !== 'string') return ''
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}
