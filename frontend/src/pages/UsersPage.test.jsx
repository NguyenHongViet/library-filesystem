import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import UsersPage from './UsersPage'
import { adminApi } from '../api/client'

vi.mock('../api/client', () => ({
  adminApi: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'admin@example.com', role: 'admin' } }),
}))

const usersFixture = [
  { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin' },
  { id: 2, email: 'bob@example.com', name: 'Bob', role: 'member' },
]

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.listUsers.mockResolvedValue({ users: usersFixture })
  })

  it('lists users with their roles', async () => {
    renderWithMantine(<UsersPage />)

    expect(await screen.findByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1)
  })

  it('shows an error when loading fails', async () => {
    adminApi.listUsers.mockRejectedValue(new Error('Load failed'))
    renderWithMantine(<UsersPage />)
    expect(await screen.findByText('Load failed')).toBeInTheDocument()
  })

  it('creates a new user', async () => {
    const user = userEvent.setup()
    adminApi.createUser.mockResolvedValue({ user: { id: 3 } })

    renderWithMantine(<UsersPage />)
    await screen.findByText('bob@example.com')

    await user.click(screen.getByRole('button', { name: /new user/i }))
    await user.type(await screen.findByLabelText(/^email/i), 'carol@example.com')
    await user.type(screen.getByLabelText(/^name/i), 'Carol')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(adminApi.createUser).toHaveBeenCalledWith({
        email: 'carol@example.com',
        name: 'Carol',
        role: 'member',
        password: 'password123',
      }),
    )
    expect(adminApi.listUsers).toHaveBeenCalledTimes(2)
  })

  it('edits a user without changing the password when left blank', async () => {
    const user = userEvent.setup()
    adminApi.updateUser.mockResolvedValue({ user: { id: 2 } })

    renderWithMantine(<UsersPage />)
    await screen.findByText('bob@example.com')

    await user.click(screen.getByRole('button', { name: 'Edit bob@example.com' }))
    const nameInput = await screen.findByLabelText(/^name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Bobby')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(adminApi.updateUser).toHaveBeenCalledWith(2, {
        email: 'bob@example.com',
        name: 'Bobby',
        role: 'member',
      }),
    )
  })

  it('shows a form error when saving fails', async () => {
    const user = userEvent.setup()
    adminApi.createUser.mockRejectedValue(new Error('Email has already been taken'))

    renderWithMantine(<UsersPage />)
    await screen.findByText('bob@example.com')

    await user.click(screen.getByRole('button', { name: /new user/i }))
    await user.type(await screen.findByLabelText(/^email/i), 'dupe@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Email has already been taken')).toBeInTheDocument()
  })

  it('deletes another user', async () => {
    const user = userEvent.setup()
    adminApi.deleteUser.mockResolvedValue(null)

    renderWithMantine(<UsersPage />)
    await screen.findByText('bob@example.com')

    await user.click(screen.getByRole('button', { name: 'Delete bob@example.com' }))

    await waitFor(() => expect(adminApi.deleteUser).toHaveBeenCalledWith(2))
    expect(adminApi.listUsers).toHaveBeenCalledTimes(2)
  })

  it('closes the form modal on cancel', async () => {
    const user = userEvent.setup()

    renderWithMantine(<UsersPage />)
    await screen.findByText('bob@example.com')

    await user.click(screen.getByRole('button', { name: /new user/i }))
    await screen.findByLabelText(/^email/i)
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() =>
      expect(screen.queryByLabelText(/^email/i)).not.toBeInTheDocument(),
    )
    expect(adminApi.createUser).not.toHaveBeenCalled()
  })

  it('shows an error when a delete fails', async () => {
    const user = userEvent.setup()
    adminApi.deleteUser.mockRejectedValue(new Error('Delete failed'))

    renderWithMantine(<UsersPage />)
    await screen.findByText('bob@example.com')

    await user.click(screen.getByRole('button', { name: 'Delete bob@example.com' }))

    expect(await screen.findByText('Delete failed')).toBeInTheDocument()
  })

  it('disables deleting the current user', async () => {
    renderWithMantine(<UsersPage />)
    await screen.findByText('admin@example.com')

    expect(screen.getByRole('button', { name: 'Delete admin@example.com' })).toBeDisabled()
  })
})
