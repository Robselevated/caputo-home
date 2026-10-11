import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const syncState = { isOnline: false, pendingCount: 2, syncing: false, syncNow: vi.fn() }
vi.mock('../hooks/useOfflineSync', () => ({ useOfflineSync: vi.fn(() => syncState) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ profile: { household_id: 'hh' } }) }))

import { useOfflineSync } from '../hooks/useOfflineSync'
import Layout from './Layout'

describe('Layout', () => {
  it('owns the single offline-sync instance and shows the indicator on every page', () => {
    render(<MemoryRouter initialEntries={['/pantry']}><Layout><div>page</div></Layout></MemoryRouter>)
    expect(useOfflineSync).toHaveBeenCalledWith('hh')
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
    expect(screen.getByText('page')).toBeInTheDocument()
  })
})
