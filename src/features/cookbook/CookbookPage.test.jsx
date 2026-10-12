import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../lib/authFetch', () => ({ authFetch: vi.fn() }))

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import { keys } from '../../queries/keys'
import CookbookPage from './CookbookPage'

const tacos = { id: 'r1', household_id: 'hh', name: 'Tacos', image_url: null, tags: ['Mexican'], prep_time: 10, cook_time: 15, servings: 4, source_url: null, created_at: '2026-01-02T00:00:00Z' }
const soup = { id: 'r2', household_id: 'hh', name: 'Soup', image_url: null, tags: [], prep_time: null, cook_time: 30, servings: null, source_url: null, created_at: '2026-01-01T00:00:00Z' }

function renderPage(seed = true) {
  const { wrapper: QueryWrapper, qc } = createWrapper()
  if (seed) qc.setQueryData(keys.recipes('hh'), [tacos, soup])
  const wrapper = ({ children }) => (
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/cookbook']}>{children}</MemoryRouter></ToastProvider></QueryWrapper>
  )
  return render(<CookbookPage />, { wrapper })
}

describe('CookbookPage', () => {
  beforeEach(() => {
    supabase.reset()
    supabase.setResult('recipes', 'select', { data: [tacos, soup], error: null })
    supabase.setResult('recipe_ingredients', 'select', {
      data: [
        { recipe_id: 'r1', name: 'shells' },
        { recipe_id: 'r1', name: 'beef' },
        { recipe_id: 'r2', name: 'noodles' },
      ],
      error: null,
    })
    supabase.setResult('inventory_items', 'select', { data: [{ id: 'a', name: 'shells', qty: 1 }, { id: 'b', name: 'beef', qty: 1 }], error: null })
  })

  it('renders the recipes from the cache with the count in the subtitle', async () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Cookbook' })).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByText('Soup')).toBeInTheDocument()
    expect(await screen.findByText(/2 recipes/)).toBeInTheDocument()
    expect(screen.getByText('25 min, 4 servings')).toBeInTheDocument()
  })

  it('shows ingredient coverage as a pill on each card', async () => {
    renderPage()
    expect(await screen.findByText('Have it all')).toBeInTheDocument()
    expect(screen.getByText('1 to buy')).toBeInTheDocument()
  })

  it('search narrows the grid', async () => {
    renderPage()
    await screen.findByText('Tacos')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search recipes' }), { target: { value: 'tac' } })
    expect(screen.queryByText('Soup')).not.toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
  })

  it('a tag pill filters the grid to recipes carrying that tag', async () => {
    renderPage()
    await screen.findByText('Tacos')
    fireEvent.click(screen.getByRole('button', { name: 'Mexican', pressed: false }))
    expect(screen.queryByText('Soup')).not.toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
  })

  it('the + button opens the add sheet with Link, Type it, Photo and Paste modes', async () => {
    renderPage()
    await screen.findByText('Tacos')
    fireEvent.click(screen.getByRole('button', { name: 'Add a recipe' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a recipe' })
    expect(within(dialog).getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByRole('tab', { name: 'Type it' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Photo' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Paste' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Paste' }))
    expect(within(dialog).getByRole('button', { name: 'Read this text' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Link' }))
    expect(within(dialog).getByRole('button', { name: 'Import recipe' })).toBeInTheDocument()
  })

  it('shows a skeleton, not a spinner, only while there is nothing cached', () => {
    supabase.setResult('recipes', 'select', () => new Promise(() => {}))
    const { container } = renderPage(false)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('Tacos')).not.toBeInTheDocument()
  })

  it('fetched ideas survive typing in the search box', async () => {
    const { authFetch } = await import('../../lib/authFetch')
    authFetch.mockResolvedValue({ ok: true, json: async () => [{ name: 'Beef tacos', description: 'Fast weeknight', ingredients: ['shells', 'beef'] }] })
    renderPage()
    await screen.findByText('Tacos')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Get ideas' })) })
    expect(await screen.findByText('Beef tacos')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search recipes' }), { target: { value: 'sou' } })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search recipes' }), { target: { value: '' } })
    expect(screen.getByText('Beef tacos')).toBeInTheDocument()
    expect(authFetch).toHaveBeenCalledTimes(1)
  })
})
