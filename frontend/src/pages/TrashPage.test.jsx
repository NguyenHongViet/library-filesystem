import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import TrashPage from './TrashPage'
import { filesApi } from '../api/client'

vi.mock('../api/client', () => ({
  filesApi: {
    listTrash: vi.fn(),
    restoreDocument: vi.fn(),
  },
}))

describe('TrashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.listTrash.mockResolvedValue({ documents: [] })
  })

  it('shows an empty state when the trash has no items', async () => {
    renderWithMantine(<TrashPage />)

    expect(await screen.findByText('The trash is empty.')).toBeInTheDocument()
  })

  it('lists trashed files with their original location', async () => {
    filesApi.listTrash.mockResolvedValue({
      documents: [
        {
          id: 10,
          name: 'old.txt',
          content_type: 'text/plain',
          byte_size: 2048,
          deleted_path: 'Reports/Q1',
          deleted_at: '2026-07-02T00:00:00Z',
        },
      ],
    })

    renderWithMantine(<TrashPage />)

    expect(await screen.findByText('old.txt')).toBeInTheDocument()
    expect(screen.getByText('Reports/Q1')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
  })

  it('falls back to "My files" when a file had no folder path', async () => {
    filesApi.listTrash.mockResolvedValue({
      documents: [
        { id: 11, name: 'loose.txt', content_type: 'text/plain', byte_size: 3, deleted_path: null },
      ],
    })

    renderWithMantine(<TrashPage />)

    expect(await screen.findByText('My files')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    filesApi.listTrash.mockRejectedValue(new Error('Network down'))

    renderWithMantine(<TrashPage />)

    expect(await screen.findByText('Network down')).toBeInTheDocument()
  })

  it('restores a file and refreshes the list', async () => {
    const user = userEvent.setup()
    filesApi.listTrash.mockResolvedValueOnce({
      documents: [
        { id: 10, name: 'old.txt', content_type: 'text/plain', byte_size: 3, deleted_path: 'Reports' },
      ],
    })
    filesApi.restoreDocument.mockResolvedValue({ document: { id: 10 } })
    filesApi.listTrash.mockResolvedValueOnce({ documents: [] })

    renderWithMantine(<TrashPage />)
    await screen.findByText('old.txt')

    await user.click(screen.getByRole('button', { name: /restore/i }))

    expect(filesApi.restoreDocument).toHaveBeenCalledWith(10)
    expect(await screen.findByText('The trash is empty.')).toBeInTheDocument()
    await waitFor(() => expect(filesApi.listTrash).toHaveBeenCalledTimes(2))
  })

  it('shows an error when a restore fails', async () => {
    const user = userEvent.setup()
    filesApi.listTrash.mockResolvedValue({
      documents: [
        { id: 10, name: 'old.txt', content_type: 'text/plain', byte_size: 3, deleted_path: 'Reports' },
      ],
    })
    filesApi.restoreDocument.mockRejectedValue(new Error('Document not found.'))

    renderWithMantine(<TrashPage />)
    await screen.findByText('old.txt')

    await user.click(screen.getByRole('button', { name: /restore/i }))

    expect(await screen.findByText('Document not found.')).toBeInTheDocument()
  })
})
