import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import BottomNav from './BottomNav'

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><BottomNav /></MemoryRouter>)

describe('BottomNav', () => {
  it('has four tabs: Grocery, Kitchen, Planning, Cookbook', () => {
    renderAt('/grocery')
    expect(screen.getAllByRole('link').map(l => l.textContent)).toEqual(['Grocery', 'Kitchen', 'Planning', 'Cookbook'])
  })

  it('marks Kitchen current on every kitchen location path', () => {
    for (const path of ['/kitchen/pantry', '/pantry', '/fridge', '/freezer']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('link', { name: 'Kitchen' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Grocery' })).not.toHaveAttribute('aria-current')
      unmount()
    }
  })

  it('links Kitchen to the kitchen route', () => {
    renderAt('/grocery')
    expect(screen.getByRole('link', { name: 'Kitchen' })).toHaveAttribute('href', '/kitchen')
  })

  it('colours the active Kitchen tab with the showing location\'s ink', () => {
    renderAt('/kitchen/pantry')
    expect(screen.getByRole('link', { name: 'Kitchen' })).toHaveClass('text-loc-pantry-ink')
  })
})
