import { getDefaultLocation, DEFAULT_UNITS } from './constants'

// Where a bought grocery item lands in the kitchen, and with what unit.
export function checkOffParams(item) {
  const { location, category } = getDefaultLocation(item?.name)
  const unit = item?.unit || DEFAULT_UNITS[location]?.[category] || 'count'
  return { location, category, unit }
}

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, '\\$&')
}

// Check an item off the grocery list: one transactional RPC
// (recently_bought + item_history + inventory merge + delete). If the function
// is not deployed yet (PGRST202) fall back to the legacy multi-request path so a
// client deploy that races the SQL still works.
export async function checkOffGroceryItem(client, { item, householdId, userId }) {
  const { location, category, unit } = checkOffParams(item)

  const { data, error } = await client.rpc('check_off_grocery_item', {
    p_item_id: item.id,
    p_location: location,
    p_category: category,
    p_unit: unit,
  })

  if (!error) return { error: null, via: 'rpc', result: data }
  if (error.code !== 'PGRST202') return { error, via: 'rpc' }

  return legacyCheckOff(client, { item, householdId, userId, location, category, unit })
}

async function legacyCheckOff(client, { item, householdId, userId, location, category, unit }) {
  const { error: insertError } = await client.from('recently_bought').insert({
    household_id: householdId,
    name: item.name,
    qty: item.qty,
    unit: item.unit,
    store: item.store,
    notes: item.notes,
    bought_by: userId,
  })
  if (insertError) return { error: insertError, via: 'legacy' }

  await client.from('item_history').upsert(
    { household_id: householdId, name: item.name },
    { onConflict: 'household_id,name' }
  )

  const addQty = item.qty || 1
  const { data: existing } = await client
    .from('inventory_items')
    .select('id, qty')
    .eq('household_id', householdId)
    .eq('location', location)
    .ilike('name', escapeLike(item.name))
    .limit(1)
    .maybeSingle()

  if (existing) {
    await client.from('inventory_items').update({
      qty: (existing.qty || 0) + addQty,
      updated_by: userId,
    }).eq('id', existing.id)
  } else {
    await client.from('inventory_items').insert({
      household_id: householdId,
      name: item.name,
      qty: addQty,
      unit,
      location,
      category,
      updated_by: userId,
    })
  }

  const { error: deleteError } = await client.from('grocery_items').delete().eq('id', item.id)
  return { error: deleteError ?? null, via: 'legacy' }
}
