import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import SharedPage from './SharedPage'
import { filesApi } from '../api/client'

vi.mock('../api/client', () => ({
  filesApi: {
    listSharedUsers: vi.fn(),
    listSharedEntries: vi.fn(),
  },
}))

describe('SharedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.listSharedUsers.mockResolvedValue({ users: [] })
    filesApi.listSharedEntries.mockResolvedValue({ folders: [], documents: [] })
  })

  it('shows an empty state when there are no other users', async () => {
    renderWithMantine(<SharedPage />)

    expect(await screen.findByText('There are no other users yet.')).toBeInTheDocument()
  })

  it('lists users who have shared files', async () => {
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })

    renderWithMantine(<SharedPage />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows an error when loading users fails', async () => {
    filesApi.listSharedUsers.mockRejectedValue(new Error('Network down'))

    renderWithMantine(<SharedPage />)

    expect(await screen.findByText('Network down')).toBeInTheDocument()
  })

  it('opens a user and lists their public folders and files', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValue({
      folders: [{ id: 5, name: 'Reports', parent_id: null }],
      documents: [{ id: 9, name: 'public.txt', content_type: 'text/plain', byte_size: 2048 }],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))

    expect(await screen.findByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('public.txt')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    expect(filesApi.listSharedEntries).toHaveBeenCalledWith(1, null)
  })

  it('navigates into a shared folder and back through the breadcrumb', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValueOnce({
      folders: [{ id: 5, name: 'Reports', parent_id: null }],
      documents: [],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByText('Reports')

    filesApi.listSharedEntries.mockResolvedValueOnce({
      folders: [],
      documents: [{ id: 11, name: 'nested.txt', content_type: 'text/plain', byte_size: 3 }],
    })

    await user.click(screen.getByTestId('shared-folder-5'))

    expect(await screen.findByText('nested.txt')).toBeInTheDocument()
    await waitFor(() => expect(filesApi.listSharedEntries).toHaveBeenLastCalledWith(1, 5))

    await user.click(screen.getByRole('button', { name: 'Alice' }))
    await waitFor(() => expect(filesApi.listSharedEntries).toHaveBeenLastCalledWith(1, null))
  })

  it('returns to the user list through the breadcrumb', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByRole('button', { name: 'Shared files' })

    await user.click(screen.getByRole('button', { name: 'Shared files' }))

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows an error when loading a user\'s entries fails', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockRejectedValue(new Error('Entries failed'))

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))

    expect(await screen.findByText('Entries failed')).toBeInTheDocument()
  })

  it('jumps back through an intermediate folder in the breadcrumb', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries
      .mockResolvedValueOnce({ folders: [{ id: 5, name: 'Reports' }], documents: [] })
      .mockResolvedValueOnce({ folders: [{ id: 6, name: 'Q1' }], documents: [] })
      .mockResolvedValueOnce({ folders: [], documents: [] })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await user.click(await screen.findByTestId('shared-folder-5'))
    await user.click(await screen.findByTestId('shared-folder-6'))

    // Now at Alice > Reports > Q1; "Reports" is an intermediate, clickable crumb.
    filesApi.listSharedEntries.mockResolvedValueOnce({
      folders: [{ id: 6, name: 'Q1' }],
      documents: [],
    })
    await user.click(screen.getByRole('button', { name: 'Reports' }))

    await waitFor(() => expect(filesApi.listSharedEntries).toHaveBeenLastCalledWith(1, 5))
  })

  it('shows an empty state inside a user with nothing shared', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))

    expect(await screen.findByText('Nothing shared here.')).toBeInTheDocument()
  })
})
