import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})

import { supabase } from '../../lib/supabase'
import { chainHas } from '../../test/fakeSupabase'
import { createWrapper } from '../../test/queryWrapper'
import ReceiptReview from './ReceiptReviewSheet'

const items = [
  { name: 'Milk', qty: 1, unit: 'gallon', location: 'fridge', category: 'Dairy' },
  { name: 'Rice', qty: 2, location: 'pantry', category: 'Dry Goods' },
]
const groceryRows = [
  { id: 'g1', household_id: 'hh', name: 'milk', qty: 1, unit: null, store: null, checked: false, created_at: '2026-10-01T00:00:00Z' },
  { id: 'g2', household_id: 'hh', name: 'Bread', qty: 1, unit: null, store: null, checked: false, created_at: '2026-10-01T00:00:00Z' },
]

function renderSheet() {
  const onConfirm = vi.fn(async () => {})
  const onCancel = vi.fn()
  const { wrapper } = createWrapper()
  render(<ReceiptReview items={items} onConfirm={onConfirm} onCancel={onCancel} householdId="hh" />, { wrapper })
  return { onConfirm, onCancel }
}

const tile = (name) => screen.getByRole('heading', { level: 2, name }).closest('section')

describe('ReceiptReviewSheet', () => {
  beforeEach(() => {
    supabase.reset()
    supabase.setResult('grocery_items', 'select', { data: groceryRows, error: null })
    supabase.setResult('grocery_items', 'delete', { data: null, error: null })
  })

  it('shows the list items it will take off and the kitchen items it will add as two tiles', async () => {
    renderSheet()
    screen.getByRole('dialog', { name: 'Found 2 items' })
    const adding = tile('Adding to the kitchen')
    expect(within(adding).getByText('Milk')).toBeInTheDocument()
    expect(within(adding).getByText('Rice')).toBeInTheDocument()
    expect(within(adding).getByText(/Fridge/)).toBeInTheDocument()
    const removing = await screen.findByRole('heading', { level: 2, name: 'Taking off the list' })
    expect(await within(removing.closest('section')).findByText('milk')).toBeInTheDocument()
    expect(within(removing.closest('section')).queryByText('Bread')).not.toBeInTheDocument()
  })

  it('confirm adds per location, then deletes the matching list rows and nothing else', async () => {
    const { onConfirm } = renderSheet()
    await screen.findByText('milk')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add 2 to the kitchen' })) })
    expect(onConfirm).toHaveBeenCalledTimes(2)
    const byLoc = Object.fromEntries(onConfirm.mock.calls.map(([rows, loc]) => [loc, rows.map(r => r.name)]))
    expect(byLoc).toEqual({ fridge: ['Milk'], pantry: ['Rice'] })
    const deletes = supabase.callsFor('grocery_items', 'delete')
    expect(deletes).toHaveLength(1)
    expect(chainHas(deletes[0], 'in', 'id', ['g1'])).toBe(true)
  })

  it('keeping a matched row on the list skips its delete; excluding an add keeps it off the kitchen', async () => {
    const { onConfirm } = renderSheet()
    await screen.findByText('milk')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Take milk off the list' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Rice' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add 1 to the kitchen' })) })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0][1]).toBe('fridge')
    expect(supabase.callsFor('grocery_items', 'delete')).toHaveLength(0)
  })

  it('moving an item to another location changes which group it is confirmed with', async () => {
    const { onConfirm } = renderSheet()
    await screen.findByText('milk')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rice' }))
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'freezer' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add 2 to the kitchen' })) })
    const locs = onConfirm.mock.calls.map(([, loc]) => loc).sort()
    expect(locs).toEqual(['freezer', 'fridge'])
    const rice = onConfirm.mock.calls.find(([, loc]) => loc === 'freezer')[0][0]
    expect(rice).toMatchObject({ name: 'Rice', location: 'freezer', category: 'Beef', unit: 'lbs' })
  })

  it('Discard cancels without writing anything', () => {
    const { onCancel, onConfirm } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(supabase.callsFor('grocery_items', 'delete')).toHaveLength(0)
  })
})
