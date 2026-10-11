import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../lib/authFetch', () => ({ authFetch: vi.fn() }))

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import RecipeEditPage from './RecipeEditPage'

const detail = {
  id: 'r1', household_id: 'hh', name: 'Tacos', description: 'Weeknight tacos', image_url: null, source_image_url: null,
  servings: 4, prep_time: 10, cook_time: 15, tags: ['Mexican'], instructions: 'Warm the shells.', notes: 'Double the beef.',
  source_url: null, created_at: '2026-01-02T00:00:00Z',
  ingredients: [
    { id: 'i1', recipe_id: 'r1', name: 'shells', qty: 2, qty_text: '2', unit: 'count', notes: null, section: null, position: 0 },
    { id: 'i2', recipe_id: 'r1', name: 'beef', qty: 0.5, qty_text: '1/2', unit: 'lb', notes: 'ground', section: 'Filling', position: 1 },
  ],
}

function renderAt() {
  const { wrapper: QueryWrapper } = createWrapper()
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/cookbook/r1/edit']}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(
    <Routes>
      <Route path="/cookbook/:id/edit" element={<RecipeEditPage />} />
      <Route path="/cookbook/:id" element={<p>detail page</p>} />
    </Routes>,
    { wrapper }
  )
}

describe('RecipeEditPage', () => {
  beforeEach(() => {
    supabase.reset()
    supabase.setResult('recipes', 'select', (record) => (
      record.chain.some(([m]) => m === 'single') ? { data: detail, error: null } : { data: [detail], error: null }
    ))
  })

  it('fills the form from the full recipe, keeping quantities exactly as typed', async () => {
    renderAt()
    expect(await screen.findByLabelText('Name')).toHaveValue('Tacos')
    expect(screen.getByLabelText('Servings')).toHaveValue(4)
    expect(screen.getByLabelText('Tags')).toHaveValue('Mexican')
    expect(screen.getByLabelText('Ingredient 1 name')).toHaveValue('shells')
    expect(screen.getByLabelText('Ingredient 2 quantity')).toHaveValue('1/2')
    expect(screen.getByLabelText('Section name')).toHaveValue('Filling')
  })

  it('Save changes updates the recipe and rewrites its ingredients, then returns to the recipe', async () => {
    renderAt()
    const name = await screen.findByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Street tacos' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    const updates = supabase.callsFor('recipes', 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0].chain[0][1]).toMatchObject({ name: 'Street tacos', servings: 4, tags: ['Mexican'] })
    expect(supabase.callsFor('recipe_ingredients', 'delete')).toHaveLength(1)
    const rows = supabase.callsFor('recipe_ingredients', 'insert')[0].chain[0][1]
    expect(rows.map(r => r.qty_text)).toEqual(['2', '1/2'])
    expect(rows[1]).toMatchObject({ qty: 0.5, section: 'Filling' })
    expect(await screen.findByText('detail page')).toBeInTheDocument()
  })

  it('a save error stays on the page with a toast', async () => {
    supabase.setResult('recipes', 'update', { data: null, error: { message: 'row is locked' } })
    renderAt()
    await screen.findByLabelText('Name')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(await screen.findByRole('status')).toHaveTextContent('row is locked')
    expect(screen.queryByText('detail page')).not.toBeInTheDocument()
  })
})
