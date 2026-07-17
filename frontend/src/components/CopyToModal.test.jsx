import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import CopyToModal from './CopyToModal'
import { filesApi } from '../api/client'

vi.mock('../api/client', () => ({
  filesApi: {
    listFolders: vi.fn(),
  },
}))

describe('CopyToModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesApi.listFolders.mockResolvedValue({ folders: [] })
  })

  it('does not load folders while closed', () => {
    renderWithMantine(
      <CopyToModal opened={false} targetName="a.txt" onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(filesApi.listFolders).not.toHaveBeenCalled()
  })

  it('lists the root folders when opened', async () => {
    filesApi.listFolders.mockResolvedValue({ folders: [{ id: 1, name: 'Inbox' }] })

    renderWithMantine(
      <CopyToModal opened targetName="a.txt" onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(await screen.findByText('Inbox')).toBeInTheDocument()
    expect(filesApi.listFolders).toHaveBeenCalledWith(null)
  })

  it('confirms a copy into the root by default', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    filesApi.listFolders.mockResolvedValue({ folders: [] })

    renderWithMantine(
      <CopyToModal opened targetName="a.txt" onClose={vi.fn()} onConfirm={onConfirm} />,
    )
    await screen.findByText('No subfolders here.')

    await user.click(screen.getByRole('button', { name: /copy here/i }))

    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('navigates into a folder and confirms the copy there', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    filesApi.listFolders.mockResolvedValueOnce({ folders: [{ id: 1, name: 'Inbox' }] })

    renderWithMantine(
      <CopyToModal opened targetName="a.txt" onClose={vi.fn()} onConfirm={onConfirm} />,
    )
    await screen.findByText('Inbox')

    filesApi.listFolders.mockResolvedValueOnce({ folders: [] })
    await user.click(screen.getByTestId('dest-folder-1'))

    await waitFor(() => expect(filesApi.listFolders).toHaveBeenLastCalledWith(1))
    await user.click(screen.getByRole('button', { name: /copy here/i }))

    expect(onConfirm).toHaveBeenCalledWith(1)
  })

  it('shows an error when folders fail to load', async () => {
    filesApi.listFolders.mockRejectedValue(new Error('Cannot list folders'))

    renderWithMantine(
      <CopyToModal opened targetName="a.txt" onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(await screen.findByText('Cannot list folders')).toBeInTheDocument()
  })

  it('navigates back through the breadcrumb', async () => {
    const user = userEvent.setup()
    filesApi.listFolders
      .mockResolvedValueOnce({ folders: [{ id: 1, name: 'A' }] })
      .mockResolvedValueOnce({ folders: [{ id: 2, name: 'B' }] })
      .mockResolvedValueOnce({ folders: [] })

    renderWithMantine(
      <CopyToModal opened targetName="a.txt" onClose={vi.fn()} onConfirm={vi.fn()} />,
    )
    await user.click(await screen.findByTestId('dest-folder-1'))
    await user.click(await screen.findByTestId('dest-folder-2'))

    // At My files > A > B; click the intermediate "A" crumb.
    await user.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(filesApi.listFolders).toHaveBeenLastCalledWith(1))

    await user.click(screen.getByRole('button', { name: 'My files' }))
    await waitFor(() => expect(filesApi.listFolders).toHaveBeenLastCalledWith(null))
  })

  it('calls onClose from Cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithMantine(
      <CopyToModal opened targetName="a.txt" onClose={onClose} onConfirm={vi.fn()} />,
    )
    await screen.findByText('No subfolders here.')

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
