import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../lib/authFetch', () => ({ authFetch: vi.fn() }))
vi.mock('../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))

import { supabase } from '../lib/supabase'
import { createWrapper } from '../test/queryWrapper'
import { keys } from '../queries/keys'
import RecipeDetail from './RecipeDetail'

const tacos = { id: 'r1', household_id: 'hh', name: 'Tacos', image_url: null, tags: ['Mexican'], created_at: '2026-01-02T00:00:00Z' }

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
})

function renderAt(wrapper) {
  return render(
    <MemoryRouter initialEntries={['/cookbook/r1']}>
      <Routes><Route path="/cookbook/:id" element={<RecipeDetail />} /></Routes>
    </MemoryRouter>,
    { wrapper }
  )
}

describe('RecipeDetail', () => {
  it('paints the recipe name at once from the cached grid row while the detail loads', async () => {
    let resolveDetail
    supabase.setResult('recipes', 'select', () => new Promise(r => { resolveDetail = r }))
    const { wrapper, qc } = createWrapper()
    qc.setQueryData(keys.recipes('hh'), [tacos])
    renderAt(wrapper)
    expect(screen.getByRole('heading', { name: 'Tacos' })).toBeInTheDocument()
    // the detail fetch starts in an effect; let it begin, then answer it
    await waitFor(() => expect(typeof resolveDetail).toBe('function'))
    await act(async () => {
      resolveDetail({ data: { ...tacos, instructions: 'Warm the shells.', ingredients: [{ id: 'i1', name: 'shells', position: 0 }] }, error: null })
    })
    await waitFor(() => expect(screen.getByText('Warm the shells.')).toBeInTheDocument())
  })

  it('shows "Recipe not found" when there is nothing cached and the detail errors', async () => {
    supabase.setResult('recipes', 'select', { data: null, error: { message: 'no rows', code: 'PGRST116' } })
    const { wrapper } = createWrapper()
    renderAt(wrapper)
    await waitFor(() => expect(screen.getByText(/recipe not found/i)).toBeInTheDocument())
  })
})
