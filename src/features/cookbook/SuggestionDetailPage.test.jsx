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
import { authFetch } from '../../lib/authFetch'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import SuggestionDetailPage from './SuggestionDetailPage'

const suggestion = {
  name: 'Egg fried rice',
  description: 'Fast weeknight rice',
  matched_ingredients: ['rice', 'eggs', 'soy sauce'],
  missing_ingredients: ['scallions'],
  tags: ['Quick'],
  difficulty: 'easy',
  time_estimate: 20,
}
const expanded = {
  name: 'Egg fried rice',
  description: 'Fast weeknight rice',
  servings: 2,
  prep_time: 5,
  cook_time: 15,
  tags: ['Quick'],
  instructions: 'Scramble the eggs.\nFry the rice.',
  ingredients: [
    { name: 'rice', qty: '2', unit: 'cups', notes: '', section: '' },
    { name: 'scallions', qty: '2', unit: '', notes: 'sliced', section: '' },
  ],
}

function renderAt(state = { suggestion }) {
  const { wrapper: QueryWrapper } = createWrapper()
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={[{ pathname: '/cookbook/suggestion', state }]}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(
    <Routes>
      <Route path="/cookbook/suggestion" element={<SuggestionDetailPage />} />
      <Route path="/cookbook/:id" element={<p>detail page</p>} />
    </Routes>,
    { wrapper }
  )
}

describe('SuggestionDetailPage', () => {
  beforeEach(() => {
    supabase.reset()
    vi.clearAllMocks()
    authFetch.mockResolvedValue({ ok: true, json: async () => expanded })
    supabase.setResult('recipes', 'select', { data: [], error: null })
    supabase.setResult('grocery_items', 'select', { data: [], error: null })
    supabase.setResult('recipes', 'insert', { data: { id: 'r9', household_id: 'hh', name: 'Egg fried rice', created_at: '2026-10-01T00:00:00Z' }, error: null })
    supabase.setResult('grocery_items', 'insert', (record) => ({ data: record.chain[0][1], error: null }))
  })

  it('expands the idea into a full recipe and flags what is missing', async () => {
    renderAt()
    expect(screen.getByRole('heading', { level: 1, name: 'Egg fried rice' })).toBeInTheDocument()
    expect(await screen.findByText('scallions')).toBeInTheDocument()
    expect(screen.getByText('Fry the rice.')).toBeInTheDocument()
    expect(screen.getByText('75% match')).toBeInTheDocument()
    expect(authFetch).toHaveBeenCalledTimes(1)
  })

  it('Add to cookbook saves the recipe with its ingredients and opens it', async () => {
    renderAt()
    const save = await screen.findByRole('button', { name: 'Add to cookbook' })
    await act(async () => { fireEvent.click(save) })
    const inserts = supabase.callsFor('recipes', 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].chain[0][1]).toMatchObject({ name: 'Egg fried rice', servings: 2 })
    expect(supabase.callsFor('recipe_ingredients', 'insert')[0].chain[0][1]).toHaveLength(2)
    expect(await screen.findByText('detail page')).toBeInTheDocument()
  })

  it('Shop for the missing ingredients adds them to the grocery list', async () => {
    renderAt()
    const shop = await screen.findByRole('button', { name: 'Shop for 1 missing ingredient' })
    await act(async () => { fireEvent.click(shop) })
    const inserts = supabase.callsFor('grocery_items', 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].chain[0][1]).toMatchObject({ name: 'scallions', notes: 'For: Egg fried rice' })
  })

  it('without a suggestion in the route state it offers the way back', () => {
    renderAt(null)
    expect(screen.getByText('No suggestion to show')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to cookbook' })).toBeInTheDocument()
  })
})
