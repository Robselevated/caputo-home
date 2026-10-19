import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router'

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
    supabase.setResult('inventory_items', 'update', { data: [{ id: 's' }], error: null })
    supabase.setResult('rpc', 'merge_inventory_item', { data: { merged: false, item: { id: 'new', name: 'Rice', qty: 1, unit: 'bags', category: 'Dry Goods', location: 'pantry', household_id: 'hh' } }, error: null })
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

  it('the add sheet keeps its button disabled until name and category are set, then adds through the merge call', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Spaghetti')
    fireEvent.click(screen.getByRole('button', { name: 'Add a pantry item' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add to Pantry' })
    const submit = within(dialog).getByRole('button', { name: 'Add to Pantry' })
    expect(submit).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Rice' } })
    expect(submit).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: 'Dry Goods' } })
    expect(submit).toBeEnabled()
    await act(async () => { fireEvent.click(submit) })
    const call = supabase.callsFor('rpc', 'merge_inventory_item')[0]
    expect(call.args).toMatchObject({ p_name: 'Rice', p_location: 'pantry', p_category: 'Dry Goods', p_unit: 'bags' })
  })

  it('the add sheet focuses the name field; the edit sheet leaves the keyboard down', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Spaghetti')
    fireEvent.click(screen.getByRole('button', { name: 'Add a pantry item' }))
    const add = await screen.findByRole('dialog', { name: 'Add to Pantry' })
    expect(document.activeElement).toBe(within(add).getByLabelText('Name'))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'More options for Black beans' }))
    const edit = await screen.findByRole('dialog', { name: 'Edit item' })
    expect(document.activeElement).not.toBe(within(edit).getByLabelText('Name'))
  })

  it('stepper taps write the new quantity and a row that reaches zero shows Out', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Spaghetti')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fewer Spaghetti' })) })
    expect(supabase.callsFor('inventory_items', 'update')[0].chain[0][1]).toMatchObject({ qty: 1 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fewer Spaghetti' })) })
    expect(await screen.findByRole('button', { name: 'Remove Spaghetti' })).toBeInTheDocument()
  })

  it('a tile heading is a real heading that contains the disclosure button', async () => {
    renderAt('/kitchen/pantry')
    await screen.findByText('Spaghetti')
    const heading = screen.getByRole('heading', { level: 2, name: 'Pasta' })
    expect(within(heading).getByRole('button', { expanded: true })).toBeInTheDocument()
  })
})

describe('freshness check', () => {
  const DAY = 86400000
  const ago = (n) => new Date(Date.now() - n * DAY).toISOString()
  const fresh = (o) => ({ household_id: 'hh', subcategory: null, unit: 'count', notes: null, created_at: ago(60), checked_at: null, qty: 1, ...o })
  const stale = [
    fresh({ id: 'm', name: 'Milk', location: 'fridge', category: 'Dairy', stocked_at: ago(12) }),
    fresh({ id: 'c', name: 'Chicken thighs', location: 'freezer', category: 'Chicken', stocked_at: ago(200) }),
    fresh({ id: 'r', name: 'Rice', location: 'pantry', category: 'Dry Goods', stocked_at: ago(300) }),
  ]
  const DISMISSED = 'freshness:dismissed'

  beforeEach(() => {
    supabase.reset()
    localStorage.clear()
    supabase.setResult('inventory_items', 'update', { data: [{ id: 'm' }], error: null })
  })
  const seed = (data) => supabase.setResult('inventory_items', 'select', { data, error: null })

  it('shows a card naming items past their usual shelf life, from any segment', async () => {
    seed(stale)
    renderAt('/kitchen/pantry')
    const card = await screen.findByRole('region', { name: 'Freshness check' })
    expect(card).toHaveTextContent('2 things might have gone off')
    expect(card).toHaveTextContent('Chicken thighs')
    expect(card).toHaveTextContent('Milk')
    expect(card).not.toHaveTextContent('Rice')
  })

  it('shows no card when everything is fresh, or before the database has the new columns', async () => {
    seed([fresh({ id: 'm', name: 'Milk', location: 'fridge', category: 'Dairy', stocked_at: ago(2) })])
    const { unmount } = renderAt('/kitchen/fridge')
    await screen.findByText('Milk')
    expect(screen.queryByRole('region', { name: 'Freshness check' })).not.toBeInTheDocument()
    unmount()
    seed(stale.map(({ checked_at, stocked_at, ...r }) => r))
    renderAt('/kitchen/fridge')
    await screen.findByText('Milk')
    expect(screen.queryByRole('region', { name: 'Freshness check' })).not.toBeInTheDocument()
  })

  it('Not now hides the card for today and leaves a quiet button', async () => {
    seed(stale)
    renderAt('/kitchen/fridge')
    const card = await screen.findByRole('region', { name: 'Freshness check' })
    fireEvent.click(within(card).getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('region', { name: 'Freshness check' })).not.toBeInTheDocument()
    expect(localStorage.getItem(DISMISSED)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(screen.getByRole('button', { name: 'Check freshness (2)' })).toBeInTheDocument()
  })

  it('Review opens the full-screen list; Still good stamps checked_at', async () => {
    seed(stale)
    renderAt('/kitchen/fridge')
    const card = await screen.findByRole('region', { name: 'Freshness check' })
    fireEvent.click(within(card).getByRole('button', { name: 'Review' }))
    const dialog = await screen.findByRole('dialog', { name: 'Still have these?' })
    expect(within(dialog).getByText('12 days in the fridge, usually 7')).toBeInTheDocument()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Milk is still good' })) })
    const update = supabase.callsFor('inventory_items', 'update')[0]
    expect(update.chain[0][1]).toHaveProperty('checked_at')
    expect(update.chain[0][1]).not.toHaveProperty('qty')
    expect(within(dialog).queryByText('Milk')).not.toBeInTheDocument()
  })

  it('Toss it waits for the undo window, Undo keeps the item, leaving marks it out', async () => {
    seed(stale)
    const { unmount } = renderAt('/kitchen/fridge')
    fireEvent.click(within(await screen.findByRole('region', { name: 'Freshness check' })).getByRole('button', { name: 'Review' }))
    const dialog = await screen.findByRole('dialog', { name: 'Still have these?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Toss Milk' })) })
    expect(supabase.callsFor('inventory_items', 'update')).toHaveLength(0)
    const toastEl = (await screen.findByText('Milk marked out')).closest('[role="status"]')
    await act(async () => { fireEvent.click(within(toastEl).getByRole('button', { name: 'Undo' })) })
    expect(within(dialog).getByText('Milk')).toBeInTheDocument()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Toss Chicken thighs' })) })
    await act(async () => { unmount() })
    await waitFor(() => expect(supabase.callsFor('inventory_items', 'update')).toHaveLength(1))
    const update = supabase.callsFor('inventory_items', 'update')[0]
    expect(update.chain[0][1]).toMatchObject({ qty: 0 })
    expect(update.chain).toEqual(expect.arrayContaining([['eq', 'id', 'c']]))
  })
})
