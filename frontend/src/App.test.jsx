import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from './test-utils'
import App from './App'
import { authApi } from './api/client'

vi.mock('./api/client', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the login page when unauthenticated', async () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))

    renderWithProviders(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it('shows the welcome content when authenticated', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'admin@example.com', name: 'Admin User' },
    })

    renderWithProviders(<App />)

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Welcome, Admin User' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('You are signed in. Start building your app here.'),
    ).toBeInTheDocument()
  })

  it('falls back to the email when the user has no name', async () => {
    authApi.me.mockResolvedValue({ user: { id: 2, email: 'noname@example.com' } })

    renderWithProviders(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Welcome, noname@example.com' }),
    ).toBeInTheDocument()
  })

  it('signs the user out', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const user = userEvent.setup()
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'admin@example.com', name: 'Admin User' },
    })
    authApi.logout.mockResolvedValue(null)

    renderWithProviders(<App />)

    const signOut = await screen.findByRole('button', { name: /sign out/i })
    await user.click(signOut)

    await waitFor(() => expect(authApi.logout).toHaveBeenCalled())
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })
})
