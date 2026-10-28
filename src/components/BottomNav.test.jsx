import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import BottomNav from './BottomNav'

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><BottomNav /></MemoryRouter>)

describe('BottomNav', () => {
  it('has five tabs with Date Night on the far right', () => {
    renderAt('/grocery')
    expect(screen.getAllByRole('link').map(l => l.textContent)).toEqual(['Grocery', 'Kitchen', 'Planning', 'Cookbook', 'Date Night'])
  })

  it('marks Date Night current on a restaurant page', () => {
    renderAt('/date-night/abc')
    expect(screen.getByRole('link', { name: 'Date Night' })).toHaveAttribute('aria-current', 'page')
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
