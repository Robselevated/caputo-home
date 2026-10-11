import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'pantry', label: 'Pantry' },
]

describe('SegmentedControl', () => {
  it('renders a tablist with the selected tab marked', () => {
    render(<SegmentedControl label="Location" options={options} value="pantry" onChange={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Location' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pantry' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Fridge' })).toHaveAttribute('aria-selected', 'false')
  })

  it('reports the tapped value', () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="Location" options={options} value="pantry" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Freezer' }))
    expect(onChange).toHaveBeenCalledWith('freezer')
  })
})
