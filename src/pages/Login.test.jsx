import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const signIn = vi.fn(async () => ({ error: null }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, signIn }) }))
import Login from './Login'

describe('Login', () => {
  it('signs in with the typed email and password from a visibly filled button', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rob@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } })
    const button = screen.getByRole('button', { name: 'Sign in' })
    expect(button.className).toMatch(/\bbg-/)
    await act(async () => { fireEvent.click(button) })
    expect(signIn).toHaveBeenCalledWith('rob@example.com', 'hunter2')
  })
})
