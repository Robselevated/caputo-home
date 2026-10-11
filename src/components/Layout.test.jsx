import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const syncState = { isOnline: false, pendingCount: 2, syncing: false, syncNow: vi.fn() }
vi.mock('../hooks/useOfflineSync', () => ({ useOfflineSync: vi.fn(() => syncState) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ profile: { household_id: 'hh' } }) }))
vi.mock('../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})

import { useOfflineSync } from '../hooks/useOfflineSync'
import { supabase } from '../lib/supabase'
import { createWrapper } from '../test/queryWrapper'
import Layout from './Layout'

describe('Layout', () => {
  beforeEach(() => { supabase.reset(); vi.clearAllMocks() })

  it('owns the single offline-sync instance and shows the indicator on every page', () => {
    const { wrapper } = createWrapper()
    render(<MemoryRouter initialEntries={['/pantry']}><Layout><div>page</div></Layout></MemoryRouter>, { wrapper })
    expect(useOfflineSync).toHaveBeenCalledWith('hh')
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
    expect(screen.getByText('page')).toBeInTheDocument()
  })

  it('hosts the single realtime channel for the household', () => {
    const { wrapper } = createWrapper()
    render(<MemoryRouter initialEntries={['/grocery']}><Layout><div>page</div></Layout></MemoryRouter>, { wrapper })
    expect(supabase.channel).toHaveBeenCalledTimes(1)
    expect(supabase.channel).toHaveBeenCalledWith(expect.stringMatching(/^household:hh/))
  })
})
