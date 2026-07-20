import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '../test-utils'
import AdminLayout from './AdminLayout'
import { authApi } from '../api/client'

vi.mock('../api/client', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the title and children', () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))

    renderWithProviders(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    )

    expect(screen.getByText('Library Filesystem')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('toggles the color scheme', async () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))
    const user = userEvent.setup()

    renderWithProviders(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    )

    const toggle = screen.getByRole('button', { name: 'Toggle color scheme' })
    await user.click(toggle)

    expect(toggle).toBeInTheDocument()
  })

  it('renders navigation links and reports the target on click', async () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    renderWithProviders(
      <AdminLayout view="files" onNavigate={onNavigate}>
        <div>content</div>
      </AdminLayout>,
    )

    await user.click(screen.getByRole('button', { name: /trash/i }))
    expect(onNavigate).toHaveBeenCalledWith('trash')

    await user.click(screen.getByRole('button', { name: /shared files/i }))
    expect(onNavigate).toHaveBeenCalledWith('shared')

    await user.click(screen.getByRole('button', { name: /my files/i }))
    expect(onNavigate).toHaveBeenCalledWith('files')
  })

  it('shows a Manage users button for admins and reports the target', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin' },
    })
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    renderWithProviders(
      <AdminLayout view="files" onNavigate={onNavigate}>
        <div>content</div>
      </AdminLayout>,
    )

    const button = await screen.findByRole('button', { name: /manage users/i })
    await user.click(button)
    expect(onNavigate).toHaveBeenCalledWith('users')
  })

  it('shows an Account button for any signed-in user and reports the target', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 2, email: 'member@example.com', name: 'Member', role: 'member' },
    })
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    renderWithProviders(
      <AdminLayout view="files" onNavigate={onNavigate}>
        <div>content</div>
      </AdminLayout>,
    )

    const button = await screen.findByRole('button', { name: /account/i })
    await user.click(button)
    expect(onNavigate).toHaveBeenCalledWith('account')
  })

  it('hides the Manage users button for non-admins', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 2, email: 'member@example.com', name: 'Member', role: 'member' },
    })

    renderWithProviders(
      <AdminLayout view="files" onNavigate={vi.fn()}>
        <div>content</div>
      </AdminLayout>,
    )

    await screen.findByText('Member')
    expect(screen.queryByRole('button', { name: /manage users/i })).not.toBeInTheDocument()
  })

  it('omits navigation links when no onNavigate handler is given', () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))

    renderWithProviders(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    )

    expect(screen.queryByRole('button', { name: /trash/i })).not.toBeInTheDocument()
  })

  it('shows the signed-in user and a sign out button', async () => {
    authApi.me.mockResolvedValue({ user: { id: 1, email: 'admin@example.com', name: 'Admin User' } })
    authApi.logout.mockResolvedValue(null)
    const user = userEvent.setup()

    renderWithProviders(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    )

    expect(await screen.findByText('Admin User')).toBeInTheDocument()

    const signOut = screen.getByRole('button', { name: /sign out/i })
    await user.click(signOut)

    await waitFor(() => expect(authApi.logout).toHaveBeenCalled())
  })
})
