import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../lib/authFetch', () => ({ authFetch: vi.fn() }))
const reimportRecipe = vi.fn()
vi.mock('../../hooks/useRecipes', async (orig) => {
  const actual = await orig()
  return { ...actual, useRecipes: (hid) => ({ ...actual.useRecipes(hid), reimportRecipe }) }
})

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import { keys } from '../../queries/keys'
import CookbookPage from './CookbookPage'

const tacos = { id: 'r1', household_id: 'hh', name: 'Tacos', image_url: null, tags: [], source_url: 'https://x/tacos', created_at: '2026-01-02T00:00:00Z' }
const soup = { id: 'r2', household_id: 'hh', name: 'Soup', image_url: null, tags: [], source_url: 'https://x/soup', created_at: '2026-01-01T00:00:00Z' }

function renderPage() {
  const { wrapper: QueryWrapper, qc } = createWrapper()
  qc.setQueryData(keys.recipes('hh'), [tacos, soup])
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/cookbook']}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(<CookbookPage />, { wrapper })
}

describe('CookbookPage bulk refresh', () => {
  beforeEach(() => {
    supabase.reset()
    reimportRecipe.mockReset()
    supabase.setResult('recipes', 'select', { data: [tacos, soup], error: null })
    supabase.setResult('recipe_ingredients', 'select', { data: [], error: null })
    supabase.setResult('inventory_items', 'select', { data: [], error: null })
  })

  it('counts failures instead of claiming every recipe refreshed', async () => {
    reimportRecipe.mockImplementation(async (id) => (id === 'r2' ? { error: 'Could not read that page' } : { data: true }))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Refresh 2 linked recipes/ }))
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Refresh all' })) })
    expect(reimportRecipe).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(/Refreshed 1 recipe\. 1 recipe could not be refreshed: Soup/)).toBeInTheDocument()
    expect(screen.queryByText('Refreshed 2 recipes from their links')).not.toBeInTheDocument()
  })

  it('says all refreshed when none failed', async () => {
    reimportRecipe.mockResolvedValue({ data: true })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Refresh 2 linked recipes/ }))
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Refresh all' })) })
    expect(await screen.findByText('Refreshed 2 recipes from their links')).toBeInTheDocument()
  })
})
