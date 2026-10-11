import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import PlanningPage from './PlanningPage'

const picks = [
  { id: 'p1', household_id: 'hh', recipe_id: 'r1', name: 'Chili', notes: 'Slow cooker', image_url: null, section: "Rob's Picks", created_at: '2026-10-01T00:00:00Z' },
  { id: 'p2', household_id: 'hh', recipe_id: null, name: 'Soup', notes: null, image_url: null, section: "Cheyene's Picks", created_at: '2026-10-02T00:00:00Z' },
]
const recipes = [
  { id: 'r1', household_id: 'hh', name: 'Chili', description: 'Slow cooker', image_url: null, tags: ['dinner'], created_at: '2026-09-01T00:00:00Z' },
  { id: 'r2', household_id: 'hh', name: 'Tacos', description: null, image_url: null, tags: [], created_at: '2026-09-02T00:00:00Z' },
]

function renderPage() {
  const { wrapper: QueryWrapper } = createWrapper()
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/planning']}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(<PlanningPage />, { wrapper })
}

describe('PlanningPage', () => {
  beforeEach(() => {
    supabase.reset()
    supabase.setResult('meal_picks', 'select', { data: picks, error: null })
    supabase.setResult('recipes', 'select', { data: recipes, error: null })
    supabase.setResult('meal_picks', 'insert', (record) => {
      const row = record.chain.find(([m]) => m === 'insert')[1]
      return { data: { ...row, created_at: '2026-10-03T00:00:00Z' }, error: null }
    })
    supabase.setResult('meal_picks', 'delete', { data: null, error: null })
  })

  it('renders one tile per section with the cached picks under them', async () => {
    renderPage()
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map(h => h.textContent)).toEqual(["Rob's Picks", "Cheyene's Picks"])
    expect(screen.getByText('Chili')).toBeInTheDocument()
    expect(screen.getByText('Slow cooker')).toBeInTheDocument()
    expect(screen.getByText('Soup')).toBeInTheDocument()
    expect(screen.getByText('Quick idea')).toBeInTheDocument()
  })

  it('the add row opens the sheet for that section and picking a recipe inserts it there', async () => {
    renderPage()
    await screen.findByText('Chili')
    fireEvent.click(screen.getByRole('button', { name: "Add a recipe to Cheyene's Picks" }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a pick' })
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Search recipes' }), { target: { value: 'tac' } })
    expect(within(dialog).queryByText('Chili')).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Add Tacos' })) })
    const inserts = supabase.callsFor('meal_picks', 'insert')
    expect(inserts).toHaveLength(1)
    const sent = inserts[0].chain.find(([m]) => m === 'insert')[1]
    expect(sent).toMatchObject({ recipe_id: 'r2', name: 'Tacos', section: "Cheyene's Picks", household_id: 'hh', user_id: 'u1' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Tacos')).toBeInTheDocument()
  })

  it('a quick idea adds a pick without a recipe', async () => {
    renderPage()
    await screen.findByText('Chili')
    fireEvent.click(screen.getByRole('button', { name: 'Add a pick' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a pick' })
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Quick idea' }))
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Taco Tuesday' } })
    fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'use leftover chicken' } })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: "Add to Rob's Picks" })) })
    const sent = supabase.callsFor('meal_picks', 'insert')[0].chain.find(([m]) => m === 'insert')[1]
    expect(sent).toMatchObject({ recipe_id: null, name: 'Taco Tuesday', notes: 'use leftover chicken', section: "Rob's Picks" })
  })

  it('removing a pick hides it behind an undo toast without deleting yet', async () => {
    renderPage()
    await screen.findByText('Soup')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove Soup' })) })
    expect(screen.queryByText('Soup')).not.toBeInTheDocument()
    const status = screen.getByText('Soup removed from the plan').closest('[role="status"]')
    expect(within(status).getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(supabase.callsFor('meal_picks', 'delete')).toHaveLength(0)
  })

  it('Shop checks the kitchen and puts the missing ingredients on the grocery list', async () => {
    supabase.setResult('recipe_ingredients', 'select', { data: [
      { id: 'i1', name: 'Ground beef', qty: 1, unit: 'lbs', qty_text: '1' },
      { id: 'i2', name: 'Kidney beans', qty: 2, unit: 'cans', qty_text: '2' },
    ], error: null })
    supabase.setResult('inventory_items', 'select', { data: [{ id: 'v1', name: 'Ground beef', qty: 2, unit: 'lbs', location: 'freezer' }], error: null })
    supabase.setResult('grocery_items', 'insert', { data: null, error: null })
    renderPage()
    await screen.findByText('Chili')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add missing ingredients for Chili to the grocery list' })) })
    const inserted = supabase.callsFor('grocery_items', 'insert')[0].chain.find(([m]) => m === 'insert')[1]
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ name: 'Kidney beans', notes: 'For: Chili', household_id: 'hh' })
    expect(await screen.findByText('Added 1 item to the grocery list')).toBeInTheDocument()
  })
})
