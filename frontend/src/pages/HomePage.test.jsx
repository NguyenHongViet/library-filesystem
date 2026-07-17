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
    getFolder: vi.fn(),
    createFolder: vi.fn(),
    moveDocument: vi.fn(),
    setFolderPublic: vi.fn(),
    setDocumentPublic: vi.fn(),
    uploadDocument: vi.fn(),
  },
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.listFolders.mockResolvedValue({ folders: [] })
    filesApi.listDocuments.mockResolvedValue({ documents: [] })
    filesApi.getFolder.mockResolvedValue({ folder: {}, breadcrumb: [] })
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

    await waitFor(() => expect(filesApi.uploadDocument).toHaveBeenCalledWith(file, null))
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

    await waitFor(() => expect(filesApi.uploadDocument).toHaveBeenCalledWith(file, null))
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

  it('navigates into a folder and shows its breadcrumb', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValueOnce({
      folders: [{ id: 1, name: 'Projects' }],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    filesApi.listFolders.mockResolvedValueOnce({ folders: [] })
    filesApi.listDocuments.mockResolvedValueOnce({
      documents: [{ id: 7, name: 'inside.txt', content_type: 'text/plain', byte_size: 5 }],
    })
    filesApi.getFolder.mockResolvedValueOnce({
      folder: { id: 1, name: 'Projects' },
      breadcrumb: [{ id: 1, name: 'Projects' }],
    })

    await user.click(screen.getByText('Projects'))

    expect(await screen.findByText('inside.txt')).toBeInTheDocument()
    await waitFor(() => expect(filesApi.getFolder).toHaveBeenCalledWith(1))
    expect(filesApi.listDocuments).toHaveBeenLastCalledWith(1)
  })

  it('returns to the root through the breadcrumb', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValueOnce({
      folders: [{ id: 1, name: 'Projects' }],
    })
    filesApi.getFolder.mockResolvedValue({
      folder: { id: 1, name: 'Projects' },
      breadcrumb: [{ id: 1, name: 'Projects' }],
    })

    renderWithMantine(<HomePage />)
    await user.click(await screen.findByText('Projects'))
    await screen.findByRole('button', { name: 'My files' })

    await user.click(screen.getByRole('button', { name: 'My files' }))

    await waitFor(() => expect(filesApi.listFolders).toHaveBeenLastCalledWith(null))
  })

  it('creates a folder in the current directory', async () => {
    const user = userEvent.setup()
    filesApi.createFolder.mockResolvedValue({ folder: { id: 2, name: 'New' } })

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    await user.click(screen.getByRole('button', { name: /new folder/i }))
    await user.type(await screen.findByLabelText('Folder name'), 'New')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(filesApi.createFolder).toHaveBeenCalledWith('New', null),
    )
  })

  it('shows an error when creating a folder fails', async () => {
    const user = userEvent.setup()
    filesApi.createFolder.mockRejectedValue(new Error('Name has already been taken'))

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    await user.click(screen.getByRole('button', { name: /new folder/i }))
    await user.type(await screen.findByLabelText('Folder name'), 'Dup')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Name has already been taken')).toBeInTheDocument()
  })

  it('does not create a folder when the name is blank', async () => {
    const user = userEvent.setup()

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    await user.click(screen.getByRole('button', { name: /new folder/i }))
    const input = await screen.findByLabelText('Folder name')
    await user.type(input, '{Enter}')

    expect(filesApi.createFolder).not.toHaveBeenCalled()
  })

  it('renders a clickable ancestor for a nested breadcrumb', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValueOnce({
      folders: [{ id: 1, name: 'Parent' }],
    })
    filesApi.getFolder.mockResolvedValue({
      folder: { id: 2, name: 'Child' },
      breadcrumb: [
        { id: 1, name: 'Parent' },
        { id: 2, name: 'Child' },
      ],
    })

    renderWithMantine(<HomePage />)
    await user.click(await screen.findByText('Parent'))

    const parentCrumb = await screen.findByRole('button', { name: 'Parent' })
    await user.click(parentCrumb)

    await waitFor(() => expect(filesApi.listFolders).toHaveBeenLastCalledWith(1))
  })

  it('moves a document into a folder when dropped onto it', async () => {
    filesApi.listFolders.mockResolvedValue({ folders: [{ id: 3, name: 'Archive' }] })
    filesApi.listDocuments.mockResolvedValue({
      documents: [{ id: 8, name: 'move-me.txt', content_type: 'text/plain', byte_size: 4 }],
    })
    filesApi.moveDocument.mockResolvedValue({ document: { id: 8, folder_id: 3 } })

    renderWithMantine(<HomePage />)
    await screen.findByText('move-me.txt')

    const folderRow = screen.getByTestId('folder-row-3')

    // A drop with no active drag (no dragStart) is a no-op.
    fireEvent.drop(folderRow)
    expect(filesApi.moveDocument).not.toHaveBeenCalled()

    fireEvent.dragStart(screen.getByTestId('document-row-8'))
    fireEvent.dragOver(folderRow)
    fireEvent.dragLeave(folderRow)
    fireEvent.drop(folderRow)

    await waitFor(() => expect(filesApi.moveDocument).toHaveBeenCalledWith(8, 3))
  })

  it('shows an error when a move fails', async () => {
    filesApi.listFolders.mockResolvedValue({ folders: [{ id: 3, name: 'Archive' }] })
    filesApi.listDocuments.mockResolvedValue({
      documents: [{ id: 8, name: 'move-me.txt', content_type: 'text/plain', byte_size: 4 }],
    })
    filesApi.moveDocument.mockRejectedValue(new Error('Document not found.'))

    renderWithMantine(<HomePage />)
    await screen.findByText('move-me.txt')

    fireEvent.dragStart(screen.getByTestId('document-row-8'))
    fireEvent.drop(screen.getByTestId('folder-row-3'))

    expect(await screen.findByText('Document not found.')).toBeInTheDocument()
  })

  it('toggles a document between public and private', async () => {
    const user = userEvent.setup()
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })
    filesApi.setDocumentPublic.mockResolvedValue({
      document: { id: 8, is_public: true },
    })

    renderWithMantine(<HomePage />)
    await screen.findByText('doc.txt')

    await user.click(screen.getByRole('button', { name: 'Private' }))

    expect(filesApi.setDocumentPublic).toHaveBeenCalledWith(8, true)
    expect(await screen.findByRole('button', { name: 'Public' })).toBeInTheDocument()
  })

  it('toggles a folder between public and private', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValue({
      folders: [{ id: 1, name: 'Projects', is_public: true }],
    })
    filesApi.setFolderPublic.mockResolvedValue({
      folder: { id: 1, is_public: false },
    })

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    await user.click(screen.getByRole('button', { name: 'Public' }))

    expect(filesApi.setFolderPublic).toHaveBeenCalledWith(1, false)
    expect(await screen.findByRole('button', { name: 'Private' })).toBeInTheDocument()
  })

  it('does not navigate into a folder when its sharing toggle is clicked', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValue({
      folders: [{ id: 1, name: 'Projects', is_public: false }],
    })
    filesApi.setFolderPublic.mockResolvedValue({ folder: { id: 1, is_public: true } })

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    await user.click(screen.getByRole('button', { name: 'Private' }))

    expect(filesApi.getFolder).not.toHaveBeenCalled()
    expect(filesApi.listDocuments).toHaveBeenCalledTimes(1)
  })

  it('shows an error when toggling document sharing fails', async () => {
    const user = userEvent.setup()
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })
    filesApi.setDocumentPublic.mockRejectedValue(new Error('Document not found.'))

    renderWithMantine(<HomePage />)
    await screen.findByText('doc.txt')

    await user.click(screen.getByRole('button', { name: 'Private' }))

    expect(await screen.findByText('Document not found.')).toBeInTheDocument()
  })

  it('shows an error when toggling folder sharing fails', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValue({
      folders: [{ id: 1, name: 'Projects', is_public: false }],
    })
    filesApi.setFolderPublic.mockRejectedValue(new Error('Folder not found.'))

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    await user.click(screen.getByRole('button', { name: 'Private' }))

    expect(await screen.findByText('Folder not found.')).toBeInTheDocument()
  })

  it('clears the drag state when a drag ends without a drop', async () => {
    filesApi.listDocuments.mockResolvedValue({
      documents: [{ id: 8, name: 'move-me.txt', content_type: 'text/plain', byte_size: 4 }],
    })

    renderWithMantine(<HomePage />)
    const row = await screen.findByTestId('document-row-8')

    fireEvent.dragStart(row)
    fireEvent.dragEnd(row)

    expect(filesApi.moveDocument).not.toHaveBeenCalled()
  })
})
