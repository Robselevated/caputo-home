import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../hooks/useScanSession', () => ({
  useScanSession: () => ({ scanning: false, results: null, error: null, uploadAndScan: vi.fn(), confirmItems: vi.fn(), cancelScan: vi.fn() }),
}))
const push = { permission: 'denied', requestPermission: vi.fn(), sendPushNotification: vi.fn(async () => {}) }
vi.mock('../../hooks/usePushNotifications', () => ({ usePushNotifications: () => push }))

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import GroceryPage from './GroceryPage'

const rows = [
  { id: 'a', household_id: 'hh', name: 'Avocados', qty: 4, unit: 'count', store: "Pilgrim's", notes: null, checked: false, sort_order: 0, created_at: '2026-10-01T00:00:00Z' },
  { id: 'c', household_id: 'hh', name: 'Chicken thighs', qty: 2, unit: 'lbs', store: 'Costco', notes: 'family pack', checked: false, sort_order: 0, created_at: '2026-10-01T00:00:00Z' },
  { id: 'h', household_id: 'hh', name: 'Half & half', qty: 1, unit: 'quart', store: null, notes: null, checked: false, sort_order: 0, created_at: '2026-10-01T00:00:00Z' },
]

function renderPage() {
  const { wrapper: QueryWrapper } = createWrapper()
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/grocery']}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(<GroceryPage />, { wrapper })
}

describe('GroceryPage', () => {
  beforeEach(() => {
    supabase.reset()
    supabase.setResult('grocery_items', 'select', { data: rows, error: null })
    supabase.setResult('recently_bought', 'select', { data: [], error: null })
    supabase.setResult('item_history', 'select', { data: [], error: null })
    supabase.setResult('grocery_items', 'insert', (args) => ({ data: Array.isArray(args) ? args[0] : args, error: null }))
    supabase.setResult('grocery_items', 'update', { data: [{ id: 'a' }], error: null })
  })
  afterEach(() => { vi.useRealTimers() })

  it('groups items into one tinted tile per store, null store under Grocery Store', async () => {
    renderPage()
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map(h => h.textContent)).toEqual(["Pilgrim's", 'Costco', 'Grocery Store'])
    expect(screen.getByText('Avocados')).toBeInTheDocument()
    expect(screen.getByText('2 lbs, family pack')).toBeInTheDocument()
  })

  it('adds from the add bar on submit and clears the field', async () => {
    renderPage()
    await screen.findByText('Avocados')
    const input = screen.getByRole('textbox', { name: 'Add to list' })
    fireEvent.change(input, { target: { value: 'Milk' } })
    await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Add to list' })) })
    expect(supabase.callsFor('grocery_items', 'insert')).toHaveLength(1)
    expect(input).toHaveValue('')
    expect(await screen.findByText('Milk')).toBeInTheDocument()
  })

  it('a tapped store pill filters to that store', async () => {
    renderPage()
    await screen.findByText('Avocados')
    fireEvent.click(screen.getByRole('button', { name: 'Costco', pressed: false }))
    expect(screen.queryByText('Avocados')).not.toBeInTheDocument()
    expect(screen.getByText('Chicken thighs')).toBeInTheDocument()
  })

  it('checking keeps the row visible as checked with an Undo toast; Undo restores it without a request', async () => {
    renderPage()
    await screen.findByText('Avocados')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Check off Avocados' }))
    expect(screen.getByRole('checkbox', { name: /Avocados/ })).toHaveAttribute('aria-checked', 'true')
    // dnd-kit renders an empty live region per tile, so find the toast by its text
    const status = (await screen.findByText('Avocados checked off')).closest('[role="status"]')
    fireEvent.click(within(status).getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('checkbox', { name: 'Check off Avocados' })).toHaveAttribute('aria-checked', 'false')
    expect(supabase.callsFor('rpc', 'check_off_grocery_item')).toHaveLength(0)
  })

  it('the check-off request goes out when the undo window closes', async () => {
    renderPage()
    await screen.findByText('Avocados')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Check off Avocados' }))
    await act(async () => { vi.advanceTimersByTime(4000) })
    expect(supabase.callsFor('rpc', 'check_off_grocery_item')).toHaveLength(1)
  })

  it('tapping a row name opens the edit sheet', async () => {
    renderPage()
    await screen.findByText('Avocados')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Avocados' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit item' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Avocados')
  })

  it('moving an item to another store in the edit sheet puts it at the end of that store', async () => {
    renderPage()
    await screen.findByText('Avocados')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Avocados' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit item' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Costco' }))
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })) })
    const update = supabase.callsFor('grocery_items', 'update')[0]
    expect(update.chain[0][1]).toMatchObject({ store: 'Costco', sort_order: 1 })
  })

  it('a recently bought chip puts the item back on the list', async () => {
    supabase.setResult('recently_bought', 'select', { data: [{ id: 'rb1', household_id: 'hh', name: 'Eggs', qty: 1, unit: 'dozen', store: 'Costco', notes: null, bought_at: new Date().toISOString() }], error: null })
    renderPage()
    await screen.findByText('Avocados')
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Add Eggs back to the list' })) })
    const insert = supabase.callsFor('grocery_items', 'insert')[0]
    expect(insert.chain[0][1]).toMatchObject({ name: 'Eggs', store: 'Costco' })
  })

  it('add-bar suggestions are plain buttons in a labelled list, not a fake listbox', async () => {
    supabase.setResult('item_history', 'select', { data: [{ name: 'Milk' }, { name: 'Millet' }], error: null })
    renderPage()
    await screen.findByText('Avocados')
    const input = screen.getByRole('textbox', { name: 'Add to list' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'mil' } })
    const list = await screen.findByRole('list', { name: 'Suggestions' })
    expect(within(list).getAllByRole('button').map(b => b.textContent)).toEqual(['Milk', 'Millet'])
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('tells screen readers how reordering really works', async () => {
    renderPage()
    await screen.findByText('Avocados')
    expect(screen.getAllByText('Press and hold an item, then drag it to reorder.').length).toBeGreaterThan(0)
    expect(screen.queryByText(/press space/i)).not.toBeInTheDocument()
  })
})
