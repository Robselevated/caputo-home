import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

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
const soup = { id: 'r2', household_id: 'hh', name: 'Soup', image_url: null, tags: ['Side'], prep_time: null, cook_time: 30, servings: null, source_url: null, created_at: '2026-01-01T00:00:00Z' }

const allRecipes = () => screen.getByRole('region', { name: 'All recipes' })

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
    expect(within(allRecipes()).getByText('Tacos')).toBeInTheDocument()
    expect(within(allRecipes()).getByText('Soup')).toBeInTheDocument()
    expect(await screen.findByText(/2 recipes/)).toBeInTheDocument()
    expect(within(allRecipes()).getByText('25 min, 4 servings')).toBeInTheDocument()
  })

  it('shows ingredient coverage as a pill on each card', async () => {
    renderPage()
    expect(await within(allRecipes()).findByText('Have it all')).toBeInTheDocument()
    expect(within(allRecipes()).getByText('1 to buy')).toBeInTheDocument()
  })

  it('search shows one flat list of matches across every meal type, without shelves', async () => {
    renderPage()
    await within(allRecipes()).findByText('Tacos')
    fireEvent.click(screen.getByRole('button', { name: /^Sides & Apps/ }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search recipes' }), { target: { value: 'tac' } })
    const results = screen.getByRole('region', { name: 'Search results' })
    expect(within(results).getByText('Tacos')).toBeInTheDocument()
    expect(screen.queryByText('Soup')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Ready to cook' })).not.toBeInTheDocument()
  })

  it('shows shelves above the full grid; a recipe can sit on several', async () => {
    renderPage()
    const ready = await screen.findByRole('region', { name: 'Ready to cook' })
    expect(within(ready).getByText('Tacos')).toBeInTheDocument()
    const quick = screen.getByRole('region', { name: 'Quick, 30 min or less' })
    expect(within(quick).getByText('Tacos')).toBeInTheDocument()
    expect(within(quick).getByText('Soup')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Slow cooker' })).not.toBeInTheDocument()
  })

  it('a meal type tab narrows the shelves and grid to that type', async () => {
    renderPage()
    await within(allRecipes()).findByText('Tacos')
    expect(screen.getByRole('button', { name: 'Dinners 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sides & Apps 1' }))
    const sides = screen.getByRole('region', { name: 'All sides & apps' })
    expect(within(sides).getByText('Soup')).toBeInTheDocument()
    expect(screen.queryByText('Tacos')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desserts 0' }))
    expect(screen.getByText('No desserts yet')).toBeInTheDocument()
  })

  it('the + button opens the add sheet with Link, Type it, Photo and Paste modes', async () => {
    renderPage()
    await within(allRecipes()).findByText('Tacos')
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

  it('has no paid "What can I make?" ideas panel', async () => {
    renderPage()
    await within(allRecipes()).findByText('Tacos')
    expect(screen.queryByRole('button', { name: 'Get ideas' })).not.toBeInTheDocument()
  })

  it('a pasted ingredient list is added after rows already typed', async () => {
    renderPage()
    await within(allRecipes()).findByText('Tacos')
    fireEvent.click(screen.getByRole('button', { name: /add a recipe/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Type it' }))
    fireEvent.change(within(dialog).getByLabelText('Ingredient 1 name'), { target: { value: 'typed thing' } })
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Paste' }))
    fireEvent.change(within(dialog).getByLabelText('Recipe text'), { target: { value: '2 cups flour\n1 tsp salt' } })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Read this text' })) })
    expect(await within(dialog).findByLabelText('Ingredient 1 name')).toHaveValue('typed thing')
    expect(within(dialog).getByLabelText('Ingredient 2 name')).toHaveValue('flour')
    expect(within(dialog).getByLabelText('Ingredient 3 name')).toHaveValue('salt')
  })
})

