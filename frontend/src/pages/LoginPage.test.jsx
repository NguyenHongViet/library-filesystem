import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '../test-utils'
import LoginPage from './LoginPage'
import { authApi } from '../api/client'

vi.mock('../api/client', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authApi.me.mockRejectedValue(new Error('Unauthorized'))
  })

  it('renders the sign in form', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
  })

  it('submits the credentials', async () => {
    const user = userEvent.setup()
    authApi.login.mockResolvedValue({ user: { id: 1, email: 'admin@example.com' } })

    renderWithProviders(<LoginPage />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'admin@example.com')
    await user.type(screen.getByPlaceholderText('Your password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith('admin@example.com', 'password123'),
    )
  })

  it('shows an error message when login fails', async () => {
    const user = userEvent.setup()
    authApi.login.mockRejectedValue(new Error('Invalid email or password.'))

    renderWithProviders(<LoginPage />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'admin@example.com')
    await user.type(screen.getByPlaceholderText('Your password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })
})
