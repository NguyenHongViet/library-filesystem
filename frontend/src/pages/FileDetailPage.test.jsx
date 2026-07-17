import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen } from '../test-utils'
import FileDetailPage from './FileDetailPage'
import { filesApi } from '../api/client'

vi.mock('../api/client', () => ({
  filesApi: {
    getDocument: vi.fn(),
    restoreVersion: vi.fn(),
    documentDownloadUrl: (id) => `/api/v1/documents/${id}/download`,
    versionDownloadUrl: (id, versionId) =>
      `/api/v1/documents/${id}/versions/${versionId}/download`,
  },
}))

const baseDocument = {
  id: 8,
  name: 'report.pdf',
  content_type: 'application/pdf',
  byte_size: 2048,
  is_public: false,
  location: 'Reports/Q1',
  updated_at: '2026-07-10T09:00:00Z',
}

describe('FileDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.getDocument.mockResolvedValue({ document: baseDocument, versions: [] })
  })

  it('shows the file details and an empty version history', async () => {
    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)

    expect(await screen.findByRole('heading', { level: 2, name: 'report.pdf' })).toBeInTheDocument()
    expect(screen.getByText('application/pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    expect(screen.getByText('This file has no earlier versions yet.')).toBeInTheDocument()
    expect(screen.getByText('Reports/Q1')).toBeInTheDocument()
    expect(filesApi.getDocument).toHaveBeenCalledWith(8)
  })

  it('shows "My files" as the location for a file at the root', async () => {
    filesApi.getDocument.mockResolvedValue({
      document: { ...baseDocument, location: null },
      versions: [],
    })

    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)

    expect(await screen.findByText('My files')).toBeInTheDocument()
  })

  it('links the download button to the current file', async () => {
    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)

    const link = await screen.findByRole('link', { name: /download/i })
    expect(link).toHaveAttribute('href', '/api/v1/documents/8/download')
  })

  it('provides a download link for each version', async () => {
    filesApi.getDocument.mockResolvedValue({
      document: baseDocument,
      versions: [
        { id: 20, version_number: 1, content_type: 'application/pdf', byte_size: 512, created_at: '2026-07-08T00:00:00Z' },
      ],
    })

    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)
    await screen.findByText('v1')

    const links = screen.getAllByRole('link', { name: /download/i })
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/api/v1/documents/8/versions/20/download')
    expect(hrefs).toContain('/api/v1/documents/8/download')
  })

  it('lists versions newest first', async () => {
    filesApi.getDocument.mockResolvedValue({
      document: baseDocument,
      versions: [
        { id: 20, version_number: 2, content_type: 'application/pdf', byte_size: 1024, created_at: '2026-07-09T00:00:00Z' },
        { id: 19, version_number: 1, content_type: 'application/pdf', byte_size: 512, created_at: '2026-07-08T00:00:00Z' },
      ],
    })

    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)

    expect(await screen.findByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('restores a version and refreshes from the response', async () => {
    const user = userEvent.setup()
    filesApi.getDocument.mockResolvedValue({
      document: baseDocument,
      versions: [
        { id: 20, version_number: 1, content_type: 'application/pdf', byte_size: 512, created_at: '2026-07-08T00:00:00Z' },
      ],
    })
    filesApi.restoreVersion.mockResolvedValue({
      document: { ...baseDocument, byte_size: 512 },
      versions: [
        { id: 21, version_number: 2, content_type: 'application/pdf', byte_size: 2048, created_at: '2026-07-11T00:00:00Z' },
      ],
    })

    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)
    await screen.findByText('v1')

    await user.click(screen.getByRole('button', { name: /restore/i }))

    expect(filesApi.restoreVersion).toHaveBeenCalledWith(8, 20)
    expect(await screen.findByText('v2')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    filesApi.getDocument.mockRejectedValue(new Error('Document not found.'))

    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)

    expect(await screen.findByText('Document not found.')).toBeInTheDocument()
  })

  it('shows an error when a restore fails', async () => {
    const user = userEvent.setup()
    filesApi.getDocument.mockResolvedValue({
      document: baseDocument,
      versions: [
        { id: 20, version_number: 1, content_type: 'application/pdf', byte_size: 512, created_at: '2026-07-08T00:00:00Z' },
      ],
    })
    filesApi.restoreVersion.mockRejectedValue(new Error('Version not found.'))

    renderWithMantine(<FileDetailPage documentId={8} onBack={vi.fn()} />)
    await screen.findByText('v1')

    await user.click(screen.getByRole('button', { name: /restore/i }))

    expect(await screen.findByText('Version not found.')).toBeInTheDocument()
  })

  it('calls onBack when the back link is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()

    renderWithMantine(<FileDetailPage documentId={8} onBack={onBack} />)
    await screen.findByRole('heading', { level: 2, name: 'report.pdf' })

    await user.click(screen.getByRole('button', { name: /back to files/i }))

    expect(onBack).toHaveBeenCalled()
  })
})
