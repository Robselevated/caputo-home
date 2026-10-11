import { toError } from './fetchers'

// Server writes used by the mutation hooks. They throw on error (so
// useMutation's onError rolls the optimistic change back) and know about the
// RPCs' PGRST202 "not deployed yet" fallbacks.

async function run(builder) {
  const res = await builder
  if (res?.error) throw toError(res.error)
  return res?.data
}

// --- grocery ---------------------------------------------------------------

export async function insertGroceryItem(client, row) {
  return run(client.from('grocery_items').insert(row).select().single())
}

export async function updateGroceryItem(client, id, changes) {
  await run(client.from('grocery_items').update(changes).eq('id', id).select('id'))
}

export async function deleteGroceryItem(client, id) {
  await run(client.from('grocery_items').delete().eq('id', id).select('id'))
}

export async function setGrocerySortOrder(client, ids, userId) {
  const { error } = await client.rpc('set_grocery_sort_order', { p_ids: ids })
  if (!error) return
  if (error.code !== 'PGRST202') throw toError(error)
  const now = new Date().toISOString()
  const results = await Promise.all(ids.map((id, index) =>
    client.from('grocery_items')
      .update({ sort_order: index, updated_by: userId, updated_at: now })
      .eq('id', id)
  ))
  const failed = results.find(r => r?.error)
  if (failed) throw toError(failed.error)
}

// --- inventory -------------------------------------------------------------

export async function mergeInventoryItem(client, data) {
  const { data: res, error } = await client.rpc('merge_inventory_item', {
    p_household_id: data.household_id,
    p_name: data.name,
    p_qty: data.qty ?? 1,
    p_unit: data.unit ?? null,
    p_location: data.location,
    p_category: data.category,
    p_subcategory: data.subcategory ?? null,
    p_notes: data.notes ?? null,
  })
  if (!error) return { merged: !!res?.merged, item: res?.item ?? null }
  if (error.code !== 'PGRST202') throw toError(error)
  const inserted = await run(client.from('inventory_items').insert(data).select().single())
  return { merged: false, item: inserted }
}

export async function updateInventoryItem(client, id, changes) {
  await run(client.from('inventory_items').update(changes).eq('id', id).select('id'))
}

export async function deleteInventoryItem(client, id) {
  const rows = await run(client.from('inventory_items').delete().eq('id', id).select('id'))
  return { alreadyGone: !rows || rows.length === 0 }
}

// --- meal picks ------------------------------------------------------------

export async function insertMealPick(client, row) {
  return run(client.from('meal_picks').insert(row).select().single())
}

export async function deleteMealPick(client, id) {
  await run(client.from('meal_picks').delete().eq('id', id))
}

export async function clearMealPickSection(client, householdId, section) {
  await run(client.from('meal_picks').delete().eq('household_id', householdId).eq('section', section))
}
