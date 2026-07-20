import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import AccountPage from './AccountPage'
import { authApi } from '../api/client'

vi.mock('../api/client', () => ({
  authApi: {
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  },
}))

const deleteAccount = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'me@example.com' }, deleteAccount }),
}))

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the signed-in email', () => {
    renderWithMantine(<AccountPage />)
    expect(screen.getByText('Signed in as me@example.com')).toBeInTheDocument()
  })

  it('disables the update button until both fields are filled', async () => {
    const user = userEvent.setup()
    renderWithMantine(<AccountPage />)

    const button = screen.getByRole('button', { name: /update password/i })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText('Current password'), 'oldpass')
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    expect(button).toBeEnabled()
  })

  it('changes the password and shows a confirmation', async () => {
    const user = userEvent.setup()
    authApi.changePassword.mockResolvedValue({ user: { id: 1 } })
    renderWithMantine(<AccountPage />)

    await user.type(screen.getByLabelText('Current password'), 'oldpass')
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() =>
      expect(authApi.changePassword).toHaveBeenCalledWith('oldpass', 'newpass123'),
    )
    const banner = await screen.findByText('Your password has been changed.')
    expect(banner).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    await waitFor(() => expect(banner).not.toBeInTheDocument())
  })

  it('shows an error when the password change fails', async () => {
    const user = userEvent.setup()
    authApi.changePassword.mockRejectedValue(new Error('Current password is invalid'))
    renderWithMantine(<AccountPage />)

    await user.type(screen.getByLabelText('Current password'), 'wrong')
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('Current password is invalid')).toBeInTheDocument()
  })

  it('deletes the account after confirming', async () => {
    const user = userEvent.setup()
    deleteAccount.mockResolvedValue(undefined)
    renderWithMantine(<AccountPage />)

    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    await user.click(await screen.findByRole('button', { name: 'Delete account' }))

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled())
  })

  it('shows an error when account deletion fails', async () => {
    const user = userEvent.setup()
    deleteAccount.mockRejectedValue(new Error('Delete failed'))
    renderWithMantine(<AccountPage />)

    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    await user.click(await screen.findByRole('button', { name: 'Delete account' }))

    expect(await screen.findByText('Delete failed')).toBeInTheDocument()
  })
})
