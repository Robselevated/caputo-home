import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})

import { supabase } from '../lib/supabase'
import { useIngredientCoverage } from './useIngredientCoverage'
import { createWrapper } from '../test/queryWrapper'

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  supabase.setResult('recipe_ingredients', 'select', { data: [{ recipe_id: 'r1', name: 'rice' }], error: null })
  supabase.setResult('inventory_items', 'select', { data: [{ name: 'Rice' }], error: null })
})

describe('useIngredientCoverage', () => {
  it('does not refetch or resubscribe when the recipes array identity changes but the ids do not', async () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = renderHook(({ recipes }) => useIngredientCoverage('hh', recipes), {
      initialProps: { recipes: [{ id: 'r1' }] },
      wrapper,
    })
    await waitFor(() => expect(result.current.r1).toEqual({ total: 1, matched: 1, percentage: 100 }))
    const fetches = () => supabase.callsFor('recipe_ingredients', 'select').length
    rerender({ recipes: [{ id: 'r1' }] })
    rerender({ recipes: [{ id: 'r1', name: 'renamed' }] })
    await new Promise(r => setTimeout(r, 20))
    expect(fetches()).toBe(1)
    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('opens no channels of its own and reads inventory from the shared cache', async () => {
    const { wrapper, qc } = createWrapper()
    const { keys } = await import('../queries/keys')
    qc.setQueryData(keys.inventory('hh'), [{ id: 'a', name: 'Rice', location: 'pantry' }])
    const { result } = renderHook(() => useIngredientCoverage('hh', [{ id: 'r1' }]), { wrapper })
    await waitFor(() => expect(result.current.r1).toEqual({ total: 1, matched: 1, percentage: 100 }))
    expect(supabase.channel).not.toHaveBeenCalled()
    expect(supabase.callsFor('inventory_items', 'select')).toHaveLength(0)
  })
})
