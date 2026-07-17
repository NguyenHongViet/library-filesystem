import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { renderWithMantine, screen } from '../test-utils'
import FileDropzone from './FileDropzone'

function makeFile(name = 'a.txt') {
  return new File(['hi'], name, { type: 'text/plain' })
}

function setup({ onDrop = vi.fn(), loading = false } = {}) {
  const ref = createRef()
  renderWithMantine(
    <FileDropzone ref={ref} onDrop={onDrop} loading={loading}>
      <div>list content</div>
    </FileDropzone>,
  )
  return { ref, onDrop }
}

describe('FileDropzone', () => {
  it('renders its children (the file list)', () => {
    setup()
    expect(screen.getByText('list content')).toBeInTheDocument()
  })

  it('opens the file dialog through the imperative ref', () => {
    const { ref } = setup()
    const input = screen.getByTestId('file-input')
    const clickSpy = vi.spyOn(input, 'click')

    ref.current.open()

    expect(clickSpy).toHaveBeenCalled()
  })

  it('emits files chosen from the dialog', async () => {
    const user = userEvent.setup()
    const { onDrop } = setup()
    const file = makeFile()

    await user.upload(screen.getByTestId('file-input'), file)

    expect(onDrop).toHaveBeenCalledWith([file])
  })

  it('shows the overlay on drag over and emits dropped files', () => {
    const { onDrop } = setup()
    const zone = screen.getByTestId('dropzone')
    const file = makeFile('dropped.txt')

    fireEvent.dragOver(zone)
    expect(screen.getByText('Drop files to upload')).toBeInTheDocument()

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(onDrop).toHaveBeenCalledWith([file])
  })

  it('hides the overlay when the drag leaves', () => {
    setup()
    const zone = screen.getByTestId('dropzone')

    fireEvent.dragOver(zone)
    expect(screen.getByText('Drop files to upload')).toBeInTheDocument()

    fireEvent.dragLeave(zone)
    expect(screen.queryByText('Drop files to upload')).not.toBeInTheDocument()
  })

  it('ignores a drop with no files', () => {
    const { onDrop } = setup()
    const zone = screen.getByTestId('dropzone')

    fireEvent.drop(zone, { dataTransfer: { files: [] } })

    expect(onDrop).not.toHaveBeenCalled()
  })

  it('does nothing while loading', () => {
    const { onDrop, ref } = setup({ loading: true })
    const input = screen.getByTestId('file-input')
    const clickSpy = vi.spyOn(input, 'click')
    const zone = screen.getByTestId('dropzone')

    ref.current.open()
    expect(clickSpy).not.toHaveBeenCalled()

    fireEvent.dragOver(zone)
    expect(screen.queryByText('Drop files to upload')).not.toBeInTheDocument()

    fireEvent.drop(zone, { dataTransfer: { files: [makeFile()] } })
    expect(onDrop).not.toHaveBeenCalled()
    expect(screen.getByText('Uploading…')).toBeInTheDocument()
  })
})
