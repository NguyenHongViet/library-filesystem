import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from './test-utils'
import App from './App'
import { authApi, filesApi } from './api/client'

vi.mock('./api/client', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  filesApi: {
    listFolders: vi.fn(),
    listDocuments: vi.fn(),
    listTrash: vi.fn(),
    uploadDocument: vi.fn(),
  },
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.listDocuments.mockResolvedValue({ documents: [] })
    filesApi.listTrash.mockResolvedValue({ folders: [], documents: [] })
  })

  it('shows the login page when unauthenticated', async () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))

    renderWithProviders(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it('shows the file browser when authenticated', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'admin@example.com', name: 'Admin User' },
    })

    renderWithProviders(<App />)

    expect(
      await screen.findByRole('heading', { level: 2, name: 'My files' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Admin User')).toBeInTheDocument()
  })

  it('falls back to the email when the user has no name', async () => {
    authApi.me.mockResolvedValue({ user: { id: 2, email: 'noname@example.com' } })

    renderWithProviders(<App />)

    expect(await screen.findByText('noname@example.com')).toBeInTheDocument()
  })

  it('navigates to the trash and back', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const user = userEvent.setup()
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'admin@example.com', name: 'Admin User' },
    })

    renderWithProviders(<App />)

    await screen.findByRole('heading', { level: 2, name: 'My files' })

    await user.click(screen.getByRole('button', { name: /^trash/i }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Trash' }),
    ).toBeInTheDocument()
    expect(filesApi.listTrash).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /my files/i }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'My files' }),
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
