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
    search: vi.fn(),
    folderDownloadUrl: (id) => `/api/v1/folders/${id}/download`,
    rootDownloadUrl: () => '/api/v1/folders/download_root',
    getDocument: vi.fn(),
    restoreVersion: vi.fn(),
    documentDownloadUrl: (id) => `/api/v1/documents/${id}/download`,
    versionDownloadUrl: (id, versionId) =>
      `/api/v1/documents/${id}/versions/${versionId}/download`,
    getFolder: vi.fn(),
    createFolder: vi.fn(),
    moveDocument: vi.fn(),
    setFolderPublic: vi.fn(),
    setDocumentPublic: vi.fn(),
    deleteFolder: vi.fn(),
    deleteDocument: vi.fn(),
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
        {
          id: 10,
          name: 'report.pdf',
          content_type: 'application/pdf',
          byte_size: 2048,
          created_at: '2026-07-20T00:00:00Z',
        },
      ],
    })

    renderWithMantine(<HomePage />)

    expect(await screen.findByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('application/pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    expect(screen.getByText('Folder')).toBeInTheDocument()
    // "Uploaded" date column
    expect(screen.getByText('Uploaded')).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
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

    await waitFor(() => expect(filesApi.uploadDocument).toHaveBeenCalledWith(file, null, ''))
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

    await waitFor(() => expect(filesApi.uploadDocument).toHaveBeenCalledWith(file, null, ''))
  })

  it('uploads a folder selected through the Upload folder button', async () => {
    const user = userEvent.setup()
    filesApi.uploadDocument.mockResolvedValue({ document: { id: 6 } })
    renderWithMantine(<HomePage />)

    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    const folderInput = screen.getByTestId('folder-input')
    const clickSpy = vi.spyOn(folderInput, 'click')
    await user.click(screen.getByRole('button', { name: /upload folder/i }))
    expect(clickSpy).toHaveBeenCalled()

    const file = new File(['hi'], 'nested.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'webkitRelativePath', { value: 'MyFolder/nested.txt' })
    fireEvent.change(folderInput, { target: { files: [file] } })

    await waitFor(() =>
      expect(filesApi.uploadDocument).toHaveBeenCalledWith(file, null, 'MyFolder'),
    )
  })

  it('shows upload progress while files are uploading', async () => {
    let resolveUpload
    filesApi.uploadDocument.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
    )
    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    const file = new File(['hi'], 'new.txt', { type: 'text/plain' })
    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [file] },
    })

    expect(await screen.findByText('Uploading 0/1…')).toBeInTheDocument()

    resolveUpload({ document: { id: 1 } })
    await waitFor(() =>
      expect(screen.queryByText('Uploading 0/1…')).not.toBeInTheDocument(),
    )
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

  it('searches the library and shows matching files and folders with location', async () => {
    const user = userEvent.setup()
    filesApi.search.mockResolvedValue({
      folders: [{ id: 3, name: 'Reports', location: null }],
      documents: [
        { id: 9, name: 'report.txt', content_type: 'text/plain', byte_size: 4, location: 'Reports' },
      ],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    await user.type(screen.getByLabelText('Search files and folders'), 'report')

    expect(await screen.findByText('report.txt')).toBeInTheDocument()
    // Folder name + the document's location column both read "Reports".
    expect(screen.getAllByText('Reports').length).toBeGreaterThanOrEqual(2)
    await waitFor(() => expect(filesApi.search).toHaveBeenCalledWith('report'))
  })

  it('shows an empty state when a search has no matches', async () => {
    const user = userEvent.setup()
    filesApi.search.mockResolvedValue({ folders: [], documents: [] })

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    await user.type(screen.getByLabelText('Search files and folders'), 'zzz')

    expect(await screen.findByText('No matches for “zzz”.')).toBeInTheDocument()
  })

  it('opens a folder from search results, leaving search mode', async () => {
    const user = userEvent.setup()
    filesApi.search.mockResolvedValue({
      folders: [{ id: 3, name: 'Reports', location: null }],
      documents: [],
    })
    filesApi.getFolder.mockResolvedValue({
      folder: { id: 3, name: 'Reports' },
      breadcrumb: [{ id: 3, name: 'Reports' }],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )
    await user.type(screen.getByLabelText('Search files and folders'), 'report')
    await user.click(await screen.findByTestId('search-folder-3'))

    await waitFor(() => expect(filesApi.getFolder).toHaveBeenCalledWith(3))
    expect(screen.getByLabelText('Search files and folders')).toHaveValue('')
  })

  it('shows an error when search fails', async () => {
    const user = userEvent.setup()
    filesApi.search.mockRejectedValue(new Error('Search failed'))

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    await user.type(screen.getByLabelText('Search files and folders'), 'x')

    expect(await screen.findByText('Search failed')).toBeInTheDocument()
  })

  it('downloads a search result file without opening its detail page', async () => {
    const user = userEvent.setup()
    filesApi.search.mockResolvedValue({
      folders: [],
      documents: [
        { id: 9, name: 'report.txt', content_type: 'text/plain', byte_size: 4, location: null },
      ],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )
    await user.type(screen.getByLabelText('Search files and folders'), 'report')
    await screen.findByTestId('search-document-9')

    const link = screen.getByRole('link', { name: 'Download report.txt' })
    link.addEventListener('click', (event) => event.preventDefault())
    await user.click(link)

    expect(filesApi.getDocument).not.toHaveBeenCalled()
  })

  it('opens the detail page from a search result file', async () => {
    const user = userEvent.setup()
    filesApi.search.mockResolvedValue({
      folders: [],
      documents: [
        { id: 9, name: 'report.txt', content_type: 'text/plain', byte_size: 4, location: null },
      ],
    })
    filesApi.getDocument.mockResolvedValue({
      document: {
        id: 9,
        name: 'report.txt',
        content_type: 'text/plain',
        byte_size: 4,
        is_public: false,
        updated_at: '2026-07-10T00:00:00Z',
      },
      versions: [],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )
    await user.type(screen.getByLabelText('Search files and folders'), 'report')
    await user.click(await screen.findByTestId('search-document-9'))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'report.txt' }),
    ).toBeInTheDocument()
    expect(filesApi.getDocument).toHaveBeenCalledWith(9)
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

  it('opens the file detail page when a file row is clicked', async () => {
    const user = userEvent.setup()
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })
    filesApi.getDocument.mockResolvedValue({
      document: {
        id: 8,
        name: 'doc.txt',
        content_type: 'text/plain',
        byte_size: 4,
        is_public: false,
        updated_at: '2026-07-10T00:00:00Z',
      },
      versions: [],
    })

    renderWithMantine(<HomePage />)
    await user.click(await screen.findByText('doc.txt'))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'doc.txt' }),
    ).toBeInTheDocument()
    expect(filesApi.getDocument).toHaveBeenCalledWith(8)

    await user.click(screen.getByRole('button', { name: /back to files/i }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'My files' }),
    ).toBeInTheDocument()
  })

  it('links the header download button to the whole root at the top level', async () => {
    renderWithMantine(<HomePage />)
    await screen.findByText(
      'This folder is empty. Drag files here or use the Upload button.',
    )

    expect(
      screen.getByRole('link', { name: /download folder/i }),
    ).toHaveAttribute('href', '/api/v1/folders/download_root')
  })

  it('links the header download button to the current folder when inside one', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValueOnce({ folders: [{ id: 1, name: 'Projects' }] })
    filesApi.getFolder.mockResolvedValue({
      folder: { id: 1, name: 'Projects' },
      breadcrumb: [{ id: 1, name: 'Projects' }],
    })

    renderWithMantine(<HomePage />)
    await user.click(await screen.findByText('Projects'))
    await screen.findByRole('button', { name: 'My files' })

    expect(
      screen.getByRole('link', { name: /download folder/i }),
    ).toHaveAttribute('href', '/api/v1/folders/1/download')
  })

  it('shows a download link on each folder row', async () => {
    filesApi.listFolders.mockResolvedValue({
      folders: [{ id: 1, name: 'Projects', is_public: false }],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    expect(
      screen.getByRole('link', { name: 'Download Projects' }),
    ).toHaveAttribute('href', '/api/v1/folders/1/download')
  })

  it('does not navigate into a folder when its download link is clicked', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValue({
      folders: [{ id: 1, name: 'Projects', is_public: false }],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    const link = screen.getByRole('link', { name: 'Download Projects' })
    link.addEventListener('click', (event) => event.preventDefault())
    await user.click(link)

    expect(filesApi.getFolder).not.toHaveBeenCalled()
  })

  it('shows a download link on each file row', async () => {
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText('doc.txt')

    expect(
      screen.getByRole('link', { name: 'Download doc.txt' }),
    ).toHaveAttribute('href', '/api/v1/documents/8/download')
  })

  it('does not open the detail page when the download link is clicked', async () => {
    const user = userEvent.setup()
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })

    renderWithMantine(<HomePage />)
    await screen.findByText('doc.txt')

    const link = screen.getByRole('link', { name: 'Download doc.txt' })
    link.addEventListener('click', (event) => event.preventDefault())
    await user.click(link)

    expect(filesApi.getDocument).not.toHaveBeenCalled()
  })

  it('does not open the detail page when the delete action is clicked', async () => {
    const user = userEvent.setup()
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })
    filesApi.deleteDocument.mockResolvedValue(null)

    renderWithMantine(<HomePage />)
    await screen.findByText('doc.txt')

    await user.click(screen.getByRole('button', { name: 'Delete doc.txt' }))

    expect(filesApi.deleteDocument).toHaveBeenCalledWith(8)
    expect(filesApi.getDocument).not.toHaveBeenCalled()
  })

  it('moves a document to the trash and refreshes the list', async () => {
    const user = userEvent.setup()
    filesApi.listDocuments.mockResolvedValueOnce({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })
    filesApi.deleteDocument.mockResolvedValue(null)
    filesApi.listDocuments.mockResolvedValueOnce({ documents: [] })

    renderWithMantine(<HomePage />)
    await screen.findByText('doc.txt')

    await user.click(screen.getByRole('button', { name: 'Delete doc.txt' }))

    expect(filesApi.deleteDocument).toHaveBeenCalledWith(8)
    await waitFor(() => expect(filesApi.listDocuments).toHaveBeenCalledTimes(2))
  })

  it('moves a folder to the trash without navigating into it', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValueOnce({
      folders: [{ id: 1, name: 'Projects', is_public: false }],
    })
    filesApi.deleteFolder.mockResolvedValue(null)
    filesApi.listFolders.mockResolvedValueOnce({ folders: [] })

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    await user.click(screen.getByRole('button', { name: 'Delete Projects' }))

    expect(filesApi.deleteFolder).toHaveBeenCalledWith(1)
    expect(filesApi.getFolder).not.toHaveBeenCalled()
  })

  it('shows an error when deleting fails', async () => {
    const user = userEvent.setup()
    filesApi.listDocuments.mockResolvedValue({
      documents: [
        { id: 8, name: 'doc.txt', content_type: 'text/plain', byte_size: 4, is_public: false },
      ],
    })
    filesApi.deleteDocument.mockRejectedValue(new Error('Document not found.'))

    renderWithMantine(<HomePage />)
    await screen.findByText('doc.txt')

    await user.click(screen.getByRole('button', { name: 'Delete doc.txt' }))

    expect(await screen.findByText('Document not found.')).toBeInTheDocument()
  })

  it('shows an error when deleting a folder fails', async () => {
    const user = userEvent.setup()
    filesApi.listFolders.mockResolvedValue({
      folders: [{ id: 1, name: 'Projects', is_public: false }],
    })
    filesApi.deleteFolder.mockRejectedValue(new Error('Folder not found.'))

    renderWithMantine(<HomePage />)
    await screen.findByText('Projects')

    await user.click(screen.getByRole('button', { name: 'Delete Projects' }))

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
