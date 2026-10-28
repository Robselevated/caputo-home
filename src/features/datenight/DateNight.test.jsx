import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { household_id: 'hh' } }) }))
vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('./placesSearch', async (orig) => ({
  ...(await orig()),
  currentCoords: vi.fn(async () => null),
  searchPlaces: vi.fn(async () => [{ placeId: 'place-new', name: 'Wild Sage', secondary: 'Spokane, WA' }]),
  getPlace: vi.fn(async () => ({ placeId: 'place-new', name: 'Wild Sage', cuisine: 'American Restaurant', address: 'Spokane', mapsUrl: 'https://maps.google.com/?cid=9' })),
}))

import { supabase } from '../../lib/supabase'
import { createWrapper } from '../../test/queryWrapper'
import { ToastProvider } from '../../components/ui/Toast'
import { searchPlaces } from './placesSearch'
import DateNightPage from './DateNightPage'
import RestaurantDetailPage from './RestaurantDetailPage'

const restaurants = [
  { id: 'a', household_id: 'hh', place_id: 'pa', name: 'Clover', cuisine: 'Italian Restaurant', status: 'list', sort_order: 0, maps_url: 'https://maps.google.com/?cid=1', created_at: '2026-10-01T00:00:00Z' },
  { id: 'z', household_id: 'hh', place_id: 'pz', name: 'Inland Pacific Kitchen', cuisine: 'Restaurant', status: 'archived', sort_order: 0, visited_at: '2026-10-20T00:00:00Z', maps_url: null, created_at: '2026-09-01T00:00:00Z' },
]

function renderAt(path) {
  const { wrapper: QueryWrapper } = createWrapper()
  return render(
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/date-night" element={<DateNightPage />} />
        <Route path="/date-night/:id" element={<RestaurantDetailPage />} />
      </Routes>
    </MemoryRouter></ToastProvider></QueryWrapper>
  )
}

beforeEach(() => {
  supabase.reset()
  vi.clearAllMocks()
  supabase.setResult('restaurants', 'select', { data: restaurants, error: null })
  supabase.setResult('restaurant_ratings', 'select', { data: [{ restaurant_id: 'z', user_id: 'u1', household_id: 'hh', score: 9.7 }, { restaurant_id: 'z', user_id: 'u2', household_id: 'hh', score: 8.5 }], error: null })
  supabase.setResult('restaurant_notes', 'select', { data: [{ id: 'n1', restaurant_id: 'z', household_id: 'hh', body: 'Rob got the steak', created_at: '2026-10-20T00:00:00Z' }], error: null })
  supabase.setResult('users', 'select', { data: [{ id: 'u2', name: 'Cheyenne Caputo' }, { id: 'u1', name: 'Rob Caputo' }], error: null })
  supabase.setResult('restaurants', 'insert', (record) => ({ data: { ...record.chain.find(([m]) => m === 'insert')[1], created_at: '2026-10-27T00:00:00Z' }, error: null }))
  supabase.setResult('restaurants', 'update', { data: null, error: null })
})

describe('DateNightPage', () => {
  it('shows Up next with the food type and a Google Maps link, and Been there with the average', async () => {
    renderAt('/date-night')
    expect(await screen.findByText('Clover')).toBeInTheDocument()
    expect(screen.getByText('Italian Restaurant')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Clover in Google Maps' })).toHaveAttribute('href', 'https://maps.google.com/?cid=1')
    expect(screen.queryByText('Inland Pacific Kitchen')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Been there' }))
    expect(screen.getByText('Inland Pacific Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Restaurant · 9.1 / 10')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Inland Pacific Kitchen in Google Maps' }).getAttribute('href')).toContain('query_place_id=pz')
  })

  it('searches Google and saves the picked place to the list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderAt('/date-night')
      await screen.findByText('Clover')
      fireEvent.click(screen.getByRole('button', { name: 'Add a restaurant' }))
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search restaurants' }), { target: { value: 'wild sage' } })
      await act(async () => { await vi.advanceTimersByTimeAsync(350) })
      expect(searchPlaces).toHaveBeenCalledTimes(1)
      fireEvent.click(await screen.findByRole('button', { name: 'Add Wild Sage' }))
      await waitFor(() => expect(supabase.callsFor('restaurants', 'insert')).toHaveLength(1))
      expect(await screen.findByRole('button', { name: 'Open Wild Sage' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('RestaurantDetailPage', () => {
  it('shows each person\'s score, the average, and the bullet notes', async () => {
    renderAt('/date-night/z')
    expect(await screen.findByRole('heading', { name: 'Inland Pacific Kitchen' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Rob')).toHaveValue('9.7')
    expect(screen.getByLabelText('Cheyenne')).toHaveValue('8.5')
    expect(screen.getByText('9.1')).toBeInTheDocument()
    expect(screen.getByText('Rob got the steak')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to list/ })).toBeInTheDocument()
  })

  it('saves a decimal score on blur and refuses one over 10', async () => {
    renderAt('/date-night/z')
    const rob = await screen.findByLabelText('Rob')
    fireEvent.change(rob, { target: { value: '10.5' } })
    fireEvent.blur(rob)
    expect(rob).toHaveAttribute('aria-invalid', 'true')
    expect(supabase.callsFor('restaurant_ratings', 'upsert')).toHaveLength(0)

    fireEvent.change(rob, { target: { value: '9.9' } })
    await act(async () => { fireEvent.blur(rob) })
    const sent = supabase.callsFor('restaurant_ratings', 'upsert')[0].chain.find(([m]) => m === 'upsert')[1]
    expect(sent).toMatchObject({ restaurant_id: 'z', user_id: 'u1', score: 9.9 })
  })

  it('We went moves a list place into Been there and shows the scores', async () => {
    renderAt('/date-night/a')
    fireEvent.click(await screen.findByRole('button', { name: /We went/ }))
    expect(await screen.findByRole('heading', { name: 'Scores' })).toBeInTheDocument()
    const changes = supabase.callsFor('restaurants', 'update')[0].chain.find(([m]) => m === 'update')[1]
    expect(changes.status).toBe('archived')
  })
})
