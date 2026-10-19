import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient } from '@tanstack/react-query'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false, profile: { household_id: 'hh' }, profileError: false, retryProfile: vi.fn(), signOut: vi.fn() }),
}))

import { QueryProvider } from '../providers/QueryProvider'
import ProtectedRoute from './ProtectedRoute'

describe('ProtectedRoute during cache restore', () => {
  it('shows a quiet blank (no spinner) while the persisted cache is restoring, then the page', async () => {
    let finishRestore
    const persister = {
      persistClient: vi.fn(async () => {}),
      restoreClient: () => new Promise(r => { finishRestore = r }),
      removeClient: vi.fn(async () => {}),
    }
    const { container } = render(
      <QueryProvider client={new QueryClient()} persister={persister}>
        <MemoryRouter><ProtectedRoute><div>the page</div></ProtectedRoute></MemoryRouter>
      </QueryProvider>
    )
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeNull()
    await act(async () => { finishRestore(undefined) })
    expect(screen.getByText('the page')).toBeInTheDocument()
  })
})
