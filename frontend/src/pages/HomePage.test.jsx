import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import HomePage from './HomePage'
import { filesApi } from '../api/client'

vi.mock('../api/client', () => ({
  filesApi: {
    listFolders: vi.fn(),
    listDocuments: vi.fn(),
    uploadDocument: vi.fn(),
  },
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.listDocuments.mockResolvedValue({ documents: [] })
  })

  it('shows an empty state when the root folder has no entries', async () => {
    renderWithMantine(<HomePage />)

    expect(
      await screen.findByText(
        'This folder is empty. Drag files here or use the Upload button.',
      ),
    ).toBeInTheDocument()
  })

  it('lists root folders and documents', async () => {
    filesApi.listFolders.mockResolvedValue({
      folders: [{ id: 1, name: 'Projects' }],
    })
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 10, name: 'report.pdf', content_type: 'application/pdf', byte_size: 2048 },
      ],
    })

    renderWithMantine(<HomePage />)

    expect(await screen.findByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('application/pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    expect(screen.getByText('Folder')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    filesApi.listFolders.mockRejectedValue(new Error('Network down'))

    renderWithMantine(<HomePage />)

    expect(await screen.findByText('Network down')).toBeInTheDocument()
  })

  it('uploads files dropped onto the list and refreshes it', async () => {
    filesApi.uploadDocument.mockResolvedValue({ document: { id: 99 } })
    renderWithMantine(<HomePage />)

    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    filesApi.listDocuments.mockResolvedValue({
      documents: [{ id: 99, name: 'new.txt', content_type: 'text/plain', byte_size: 3 }],
    })

    const file = new File(['hi'], 'new.txt', { type: 'text/plain' })
    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => expect(filesApi.uploadDocument).toHaveBeenCalledWith(file))
    expect(await screen.findByText('new.txt')).toBeInTheDocument()
    expect(filesApi.listDocuments).toHaveBeenCalledTimes(2)
  })

  it('uploads a file selected through the Upload button', async () => {
    const user = userEvent.setup()
    filesApi.uploadDocument.mockResolvedValue({ document: { id: 5 } })
    renderWithMantine(<HomePage />)

    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    const input = screen.getByTestId('file-input')
    const clickSpy = vi.spyOn(input, 'click')
    await user.click(screen.getByRole('button', { name: /upload file/i }))
    expect(clickSpy).toHaveBeenCalled()

    const file = new File(['hi'], 'picked.txt', { type: 'text/plain' })
    await user.upload(input, file)

    await waitFor(() => expect(filesApi.uploadDocument).toHaveBeenCalledWith(file))
  })

  it('shows an error when an upload fails', async () => {
    const user = userEvent.setup()
    filesApi.uploadDocument.mockRejectedValue(new Error('Upload failed. Please try again.'))
    renderWithMantine(<HomePage />)

    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    const file = new File(['hi'], 'bad.txt', { type: 'text/plain' })
    await user.upload(screen.getByTestId('file-input'), file)

    expect(
      await screen.findByText('Upload failed. Please try again.'),
    ).toBeInTheDocument()
  })
})
