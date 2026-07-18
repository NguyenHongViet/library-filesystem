import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import SharedPage from './SharedPage'
import { filesApi } from '../api/client'

vi.mock('../api/client', () => ({
  filesApi: {
    listSharedUsers: vi.fn(),
    listSharedEntries: vi.fn(),
    sharedDocumentDownloadUrl: (id) => `/api/v1/shared/documents/${id}/download`,
    sharedFolderDownloadUrl: (id) => `/api/v1/shared/folders/${id}/download`,
    copySharedDocument: vi.fn(),
    copySharedFolder: vi.fn(),
    listFolders: vi.fn(),
    searchSharedUser: vi.fn(),
  },
}))

describe('SharedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.listSharedUsers.mockResolvedValue({ users: [] })
    filesApi.listSharedEntries.mockResolvedValue({ folders: [], documents: [] })
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.searchSharedUser.mockResolvedValue({ folders: [], documents: [] })
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

    expect(
      screen.getByRole('link', { name: 'Download public.txt' }),
    ).toHaveAttribute('href', '/api/v1/shared/documents/9/download')
    expect(
      screen.getByRole('link', { name: 'Download Reports' }),
    ).toHaveAttribute('href', '/api/v1/shared/folders/5/download')
  })

  it('does not navigate into a shared folder when its download link is clicked', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValue({
      folders: [{ id: 5, name: 'Reports', parent_id: null }],
      documents: [],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByText('Reports')
    filesApi.listSharedEntries.mockClear()

    const link = screen.getByRole('link', { name: 'Download Reports' })
    link.addEventListener('click', (event) => event.preventDefault())
    await user.click(link)

    expect(filesApi.listSharedEntries).not.toHaveBeenCalled()
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

  it('copies a shared file into the chosen folder and shows a confirmation', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValue({
      folders: [],
      documents: [{ id: 9, name: 'public.txt', content_type: 'text/plain', byte_size: 4 }],
    })
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.copySharedDocument.mockResolvedValue({ document: { id: 100 } })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByText('public.txt')

    await user.click(screen.getByRole('button', { name: 'Copy public.txt' }))
    await screen.findByText('No subfolders here.')
    await user.click(screen.getByRole('button', { name: /copy here/i }))

    await waitFor(() =>
      expect(filesApi.copySharedDocument).toHaveBeenCalledWith(9, null),
    )
    expect(
      await screen.findByText('Copied "public.txt" to your library.'),
    ).toBeInTheDocument()
  })

  it('dismisses the copy confirmation and can cancel the modal', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValue({
      folders: [],
      documents: [{ id: 9, name: 'public.txt', content_type: 'text/plain', byte_size: 4 }],
    })
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.copySharedDocument.mockResolvedValue({ document: { id: 100 } })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByText('public.txt')

    // Cancel closes the modal without copying.
    await user.click(screen.getByRole('button', { name: 'Copy public.txt' }))
    await screen.findByText('No subfolders here.')
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(filesApi.copySharedDocument).not.toHaveBeenCalled()

    // Copy, then dismiss the confirmation banner.
    await user.click(screen.getByRole('button', { name: 'Copy public.txt' }))
    await screen.findByText('No subfolders here.')
    await user.click(screen.getByRole('button', { name: /copy here/i }))
    const notice = await screen.findByText('Copied "public.txt" to your library.')
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    await waitFor(() => expect(notice).not.toBeInTheDocument())
  })

  it('copies a shared folder', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValue({
      folders: [{ id: 5, name: 'Reports', parent_id: null }],
      documents: [],
    })
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.copySharedFolder.mockResolvedValue({ folder: { id: 200 } })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByText('Reports')

    await user.click(screen.getByRole('button', { name: 'Copy Reports' }))
    await screen.findByText('No subfolders here.')
    await user.click(screen.getByRole('button', { name: /copy here/i }))

    await waitFor(() => expect(filesApi.copySharedFolder).toHaveBeenCalledWith(5, null))
  })

  it('shows an error when a copy fails', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValue({
      folders: [],
      documents: [{ id: 9, name: 'public.txt', content_type: 'text/plain', byte_size: 4 }],
    })
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.copySharedDocument.mockRejectedValue(new Error('Copy failed.'))

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByText('public.txt')

    await user.click(screen.getByRole('button', { name: 'Copy public.txt' }))
    await screen.findByText('No subfolders here.')
    await user.click(screen.getByRole('button', { name: /copy here/i }))

    expect(await screen.findByText('Copy failed.')).toBeInTheDocument()
  })

  it('does not navigate into a shared folder when its copy button is clicked', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.listSharedEntries.mockResolvedValue({
      folders: [{ id: 5, name: 'Reports', parent_id: null }],
      documents: [],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await screen.findByText('Reports')
    filesApi.listSharedEntries.mockClear()

    await user.click(screen.getByRole('button', { name: 'Copy Reports' }))

    // Modal opened (folder picker loads), but we did not navigate deeper.
    expect(filesApi.listSharedEntries).not.toHaveBeenCalled()
  })

  it("searches a selected user's shared files", async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.searchSharedUser.mockResolvedValue({
      folders: [{ id: 5, name: 'Reports', parent_id: null }],
      documents: [{ id: 9, name: 'report.txt', content_type: 'text/plain', byte_size: 4 }],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))

    await user.type(screen.getByLabelText('Search shared files'), 'report')

    expect(await screen.findByText('report.txt')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    await waitFor(() => expect(filesApi.searchSharedUser).toHaveBeenCalledWith(1, 'report'))
  })

  it('opens a folder from shared search results, leaving search mode', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.searchSharedUser.mockResolvedValue({
      folders: [{ id: 5, name: 'Reports', parent_id: null }],
      documents: [],
    })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await user.type(screen.getByLabelText('Search shared files'), 'report')
    await screen.findByTestId('shared-folder-5')

    filesApi.listSharedEntries.mockClear()
    await user.click(screen.getByTestId('shared-folder-5'))

    await waitFor(() => expect(filesApi.listSharedEntries).toHaveBeenCalledWith(1, 5))
    expect(screen.getByLabelText('Search shared files')).toHaveValue('')
  })

  it('shows an error when a shared search fails', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.searchSharedUser.mockRejectedValue(new Error('Search failed'))

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await user.type(screen.getByLabelText('Search shared files'), 'x')

    expect(await screen.findByText('Search failed')).toBeInTheDocument()
  })

  it('shows an empty state when a shared search has no matches', async () => {
    const user = userEvent.setup()
    filesApi.listSharedUsers.mockResolvedValue({
      users: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
    })
    filesApi.searchSharedUser.mockResolvedValue({ folders: [], documents: [] })

    renderWithMantine(<SharedPage />)
    await user.click(await screen.findByText('Alice'))
    await user.type(screen.getByLabelText('Search shared files'), 'zzz')

    expect(await screen.findByText('No matches for “zzz”.')).toBeInTheDocument()
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
