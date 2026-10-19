import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../lib/authFetch', () => ({ authFetch: vi.fn() }))

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import RecipeDetailPage from './RecipeDetailPage'

const grid = { id: 'r1', household_id: 'hh', name: 'Tacos', image_url: null, tags: ['Mexican'], created_at: '2026-01-02T00:00:00Z' }
const detail = {
  ...grid,
  description: 'Weeknight tacos',
  servings: 4,
  prep_time: 10,
  cook_time: 15,
  source_url: null,
  notes: null,
  instructions: 'Warm the shells.\nBrown the beef.',
  ingredients: [
    { id: 'i1', recipe_id: 'r1', name: 'shells', qty: 2, qty_text: '2', unit: 'count', notes: null, section: null, position: 0 },
    { id: 'i2', recipe_id: 'r1', name: 'beef', qty: 0.5, qty_text: '1/2', unit: 'lb', notes: 'ground', section: null, position: 1 },
  ],
}

function renderAt() {
  const { wrapper: QueryWrapper } = createWrapper()
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/cookbook/r1']}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(<Routes><Route path="/cookbook/:id" element={<RecipeDetailPage />} /></Routes>, { wrapper })
}

describe('RecipeDetailPage', () => {
  beforeEach(() => {
    supabase.reset()
    supabase.setResult('recipes', 'select', (record) => (
      record.chain.some(([m]) => m === 'single') ? { data: detail, error: null } : { data: [grid], error: null }
    ))
    // Coverage reads the household's ingredients; the Make this check reads one recipe's.
    supabase.setResult('recipe_ingredients', 'select', (record) => (
      record.chain.some(([m, col]) => m === 'eq' && col === 'recipe_id')
        ? { data: detail.ingredients.map(({ id, name, qty, unit, qty_text }) => ({ id, name, qty, unit, qty_text })), error: null }
        : { data: [], error: null }
    ))
    supabase.setResult('inventory_items', 'select', { data: [{ id: 'inv1', name: 'shells', qty: 3, unit: 'count', location: 'pantry' }], error: null })
    supabase.setResult('meal_picks', 'select', { data: [], error: null })
    supabase.setResult('meal_picks', 'insert', (record) => ({ data: { ...record.chain[0][1], created_at: '2026-10-01T00:00:00Z' }, error: null }))
  })

  it('shows the title, ingredients with verbatim quantities, and numbered steps', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { level: 1, name: 'Tacos' })).toBeInTheDocument()
    expect(await screen.findByText('beef')).toBeInTheDocument()
    expect(screen.getByText('1/2 lb, ground')).toBeInTheDocument()
    expect(screen.getByText('2 count')).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: 'Steps' })
    expect(within(steps).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Warm the shells.', 'Brown the beef.'])
  })

  it('Make this opens a sheet that sorts ingredients into have and need, then consumes the kitchen', async () => {
    renderAt()
    await screen.findByText('beef')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make this' })) })
    const dialog = await screen.findByRole('dialog', { name: 'Make this' })
    const have = within(dialog).getByRole('heading', { name: 'You have' }).closest('section')
    const need = within(dialog).getByRole('heading', { name: 'You need' }).closest('section')
    expect(within(have).getByText('shells')).toBeInTheDocument()
    expect(within(need).getByText('beef')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add 1 to grocery list' })).toBeInTheDocument()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'I made this' })) })
    expect(supabase.callsFor('inventory_items', 'update')).toHaveLength(1)
    expect(await within(dialog).findByText('Inventory updated')).toBeInTheDocument()
  })

  it('Add to plan opens the section picker and saves the pick', async () => {
    renderAt()
    await screen.findByText('beef')
    fireEvent.click(screen.getByRole('button', { name: 'Add to plan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add to plan' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: "Rob's Picks" })) })
    const inserts = supabase.callsFor('meal_picks', 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].chain[0][1]).toMatchObject({ recipe_id: 'r1', name: 'Tacos', section: "Rob's Picks" })
    expect(await screen.findByText("Added to Rob's Picks")).toBeInTheDocument()
  })

  it('the options sheet asks before deleting and never uses window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderAt()
    await screen.findByText('beef')
    fireEvent.click(screen.getByRole('button', { name: 'Recipe options' }))
    const options = await screen.findByRole('dialog', { name: 'Recipe options' })
    fireEvent.click(within(options).getByRole('button', { name: 'Delete recipe' }))
    const confirmSheet = await screen.findByRole('dialog', { name: 'Delete Tacos?' })
    expect(within(confirmSheet).getByRole('button', { name: 'Keep it' })).toBeInTheDocument()
    expect(supabase.callsFor('recipes', 'delete')).toHaveLength(0)
    await act(async () => { fireEvent.click(within(confirmSheet).getByRole('button', { name: 'Delete recipe' })) })
    expect(supabase.callsFor('recipes', 'delete')).toHaveLength(1)
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('a recipe that could not load (offline, timeout) says so and offers a retry, not "deleted"', async () => {
    supabase.setResult('recipes', 'select', { data: null, error: { message: 'Request timed out' } })
    renderAt()
    expect(await screen.findByText("Couldn't load this recipe")).toBeInTheDocument()
    expect(screen.queryByText('Recipe not found')).not.toBeInTheDocument()
    supabase.setResult('recipes', 'select', (record) => (
      record.chain.some(([m]) => m === 'single') ? { data: detail, error: null } : { data: [grid], error: null }
    ))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Tacos' })).toBeInTheDocument()
  })

  it('a recipe that really is gone (PGRST116) shows not found', async () => {
    supabase.setResult('recipes', 'select', { data: null, error: { code: 'PGRST116', message: 'no rows' } })
    renderAt()
    expect(await screen.findByText('Recipe not found')).toBeInTheDocument()
  })
})
