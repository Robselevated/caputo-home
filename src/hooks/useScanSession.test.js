import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../lib/authFetch', () => ({ authFetch: vi.fn() }))

import { supabase } from '../lib/supabase'
import { useScanSession } from './useScanSession'
import { queryClient } from '../lib/queryClient'
import { keys } from '../queries/keys'

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
})

describe('useScanSession.confirmItems', () => {
  it('merges each kitchen item through merge_inventory_item (no lookup + insert pairs)', async () => {
    supabase.setResult('rpc', 'merge_inventory_item', { data: { merged: false, item: {} }, error: null })
    const { result } = renderHook(() => useScanSession('hh'))
    await act(async () => {
      await result.current.confirmItems(
        [
          { name: 'Rice', qty: 2, unit: 'bags', category: 'Pasta' },
          { name: 'Black Beans', qty: 1, category: 'Other', subcategory: null },
        ],
        'pantry',
        'u1'
      )
    })
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc).toHaveBeenCalledWith('merge_inventory_item', expect.objectContaining({
      p_household_id: 'hh', p_name: 'Rice', p_qty: 2, p_unit: 'bags', p_location: 'pantry', p_category: 'Pasta',
    }))
    expect(supabase.callsFor('inventory_items')).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  it('receipt confirms still go to recently_bought and never touch the kitchen', async () => {
    supabase.setResult('recently_bought', 'insert', { data: null, error: null })
    const { result } = renderHook(() => useScanSession('hh'))
    await act(async () => {
      await result.current.confirmItems([{ name: 'Milk', qty: 1, unit: 'gallon', store: 'Costco' }], 'receipt', 'u1')
    })
    expect(supabase.callsFor('recently_bought', 'insert')).toHaveLength(1)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('reports per-item merge failures in the error state', async () => {
    supabase.setResult('rpc', 'merge_inventory_item', { data: null, error: { code: '42501', message: 'denied' } })
    const { result } = renderHook(() => useScanSession('hh'))
    await act(async () => {
      await result.current.confirmItems([{ name: 'Rice', qty: 1, category: 'Pasta' }], 'pantry', 'u1')
    })
    expect(result.current.error).toContain('Rice')
  })
})

describe('useScanSession cache refresh', () => {
  it('refreshes the kitchen cache after a scan confirm so the list updates without realtime', async () => {
    supabase.setResult('rpc', 'merge_inventory_item', { data: { merged: false, item: {} }, error: null })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useScanSession('hh'))
    await act(async () => { await result.current.confirmItems([{ name: 'Rice', qty: 1, category: 'Pasta' }], 'pantry', 'u1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.inventory('hh') })
    spy.mockRestore()
  })

  it('reports saved and failed items and keeps the scan open when one failed', async () => {
    let n = 0
    supabase.setResult('rpc', 'merge_inventory_item', () => (++n === 1 ? { data: null, error: { message: 'boom' } } : { data: { merged: false, item: {} }, error: null }))
    const { result } = renderHook(() => useScanSession('hh'))
    const rice = { name: 'Rice', qty: 1, category: 'Pasta' }
    const beans = { name: 'Beans', qty: 1, category: 'Other' }
    let out
    await act(async () => { out = await result.current.confirmItems([rice, beans], 'pantry', 'u1') })
    expect(out.failed).toEqual([rice])
    expect(out.saved).toEqual([beans])
    expect(result.current.error).toContain('Rice')
  })
})
