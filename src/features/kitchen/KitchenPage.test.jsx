import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../hooks/useScanSession', () => ({
  useScanSession: () => ({ scanning: false, results: null, error: null, uploadAndScan: vi.fn(), confirmItems: vi.fn(), cancelScan: vi.fn() }),
}))

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import { kitchenRoutes } from './routes'
import { KITCHEN_LAST_KEY } from './locationTheme'

const d = '2026-10-01T00:00:00Z'
const rows = [
  { id: 's', name: 'Spaghetti', location: 'pantry', category: 'Pasta', subcategory: null, qty: 2, unit: 'boxes', notes: null, created_at: d },
  { id: 'o', name: 'Orzo', location: 'pantry', category: 'Pasta', subcategory: null, qty: 0, unit: 'boxes', notes: null, created_at: d },
  { id: 'b', name: 'Black beans', location: 'pantry', category: 'Canned Goods', subcategory: null, qty: 3, unit: 'cans', notes: null, created_at: d },
  { id: 'm', name: 'Milk', location: 'fridge', category: 'Dairy', subcategory: null, qty: 1, unit: 'count', notes: null, created_at: d },
].map(r => ({ household_id: 'hh', ...r }))

function renderAt(path) {
  const { wrapper: QueryWrapper } = createWrapper()
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(<Routes>{kitchenRoutes()}</Routes>, { wrapper })
}

describe('Kitchen', () => {
  beforeEach(() => {
    supabase.reset()
    localStorage.clear()
    supabase.setResult('inventory_items', 'select', { data: rows, error: null })
    supabase.setResult('inventory_items', 'delete', { data: [{ id: 'o' }], error: null })
  })

  it('the legacy /pantry path shows the Pantry segment with that location\'s category tiles', async () => {
    renderAt('/pantry')
    expect(await screen.findByRole('tab', { name: 'Pantry' })).toHaveAttribute('aria-selected', 'true')
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map(h => h.textContent)).toEqual(['Pasta', 'Canned Goods'])
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
  })

  it('switching the segment swaps the tiles without leaving the page', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Spaghetti')
    fireEvent.click(screen.getByRole('tab', { name: 'Fridge' }))
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.queryByText('Spaghetti')).not.toBeInTheDocument()
    expect(localStorage.getItem(KITCHEN_LAST_KEY)).toBe('fridge')
  })

  it('/kitchen opens the last-used location', async () => {
    localStorage.setItem(KITCHEN_LAST_KEY, 'freezer')
    renderAt('/kitchen')
    expect(await screen.findByRole('tab', { name: 'Freezer' })).toHaveAttribute('aria-selected', 'true')
  })

  it('an item at zero shows Out with Buy and Remove; Remove hides it behind an undo toast', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Orzo')
    expect(screen.getByText('Out')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Orzo to grocery list' })).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove Orzo' })) })
    expect(screen.queryByText('Orzo')).not.toBeInTheDocument()
    expect(screen.getByText('Orzo removed from Pantry')).toBeInTheDocument()
    expect(supabase.callsFor('inventory_items', 'delete')).toHaveLength(0)
  })

  it('search narrows the rows', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Spaghetti')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search pantry' }), { target: { value: 'bean' } })
    expect(screen.queryByText('Spaghetti')).not.toBeInTheDocument()
    expect(screen.getByText('Black beans')).toBeInTheDocument()
  })

  it('the add button opens a sheet for this location', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Spaghetti')
    fireEvent.click(screen.getByRole('button', { name: 'Add a pantry item' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add to Pantry' })
    expect(within(dialog).getByLabelText('Category')).toBeInTheDocument()
  })

  it('the edit sheet opens prefilled with the item\'s category, quantity and unit', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Black beans')
    fireEvent.click(screen.getByRole('button', { name: 'More options for Black beans' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit item' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Black beans')
    expect(within(dialog).getByLabelText('Category')).toHaveValue('Canned Goods')
    expect(within(dialog).getByLabelText('Quantity')).toHaveValue(3)
    expect(within(dialog).getByLabelText('Unit')).toHaveValue('cans')
  })
})
