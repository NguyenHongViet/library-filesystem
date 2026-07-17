import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { renderWithMantine, screen, waitFor } from '../test-utils'
import FileDropzone from './FileDropzone'

function makeFile(name = 'a.txt') {
  return new File(['hi'], name, { type: 'text/plain' })
}

function setup({ onDrop = vi.fn(), loading = false, progress = null } = {}) {
  const ref = createRef()
  renderWithMantine(
    <FileDropzone ref={ref} onDrop={onDrop} loading={loading} progress={progress}>
      <div>list content</div>
    </FileDropzone>,
  )
  return { ref, onDrop }
}

// Minimal FileSystemEntry stand-ins for drag-and-drop traversal.
function fileEntry(name, file) {
  return { isFile: true, isDirectory: false, name, file: (cb) => cb(file) }
}

function dirEntry(name, children) {
  let done = false
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => ({
      readEntries: (cb) => {
        if (done) return cb([])
        done = true
        cb(children)
      },
    }),
  }
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

  it('opens the folder dialog through the imperative ref', () => {
    const { ref } = setup()
    const input = screen.getByTestId('folder-input')
    const clickSpy = vi.spyOn(input, 'click')

    ref.current.openFolder()

    expect(clickSpy).toHaveBeenCalled()
  })

  it('emits files chosen from the dialog as items with an empty path', async () => {
    const user = userEvent.setup()
    const { onDrop } = setup()
    const file = makeFile()

    await user.upload(screen.getByTestId('file-input'), file)

    expect(onDrop).toHaveBeenCalledWith([{ file, path: '' }])
  })

  it('derives folder paths from a directory pick', async () => {
    const { onDrop } = setup()
    const file = makeFile('b.txt')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'MyFolder/sub/b.txt' })

    fireEvent.change(screen.getByTestId('folder-input'), { target: { files: [file] } })

    expect(onDrop).toHaveBeenCalledWith([{ file, path: 'MyFolder/sub' }])
  })

  it('shows the overlay on drag over and emits dropped files', () => {
    const { onDrop } = setup()
    const zone = screen.getByTestId('dropzone')
    const file = makeFile('dropped.txt')

    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'] } })
    expect(screen.getByText('Drop files and folders to upload')).toBeInTheDocument()

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(onDrop).toHaveBeenCalledWith([{ file, path: '' }])
  })

  it('traverses dropped folders and keeps their structure', async () => {
    const { onDrop } = setup()
    const zone = screen.getByTestId('dropzone')
    const fileA = makeFile('a.txt')
    const fileB = makeFile('b.txt')
    const tree = dirEntry('MyFolder', [
      fileEntry('a.txt', fileA),
      dirEntry('sub', [fileEntry('b.txt', fileB)]),
    ])

    fireEvent.drop(zone, {
      dataTransfer: {
        types: ['Files'],
        items: [{ webkitGetAsEntry: () => tree }],
        files: [],
      },
    })

    await waitFor(() => expect(onDrop).toHaveBeenCalled())
    expect(onDrop).toHaveBeenCalledWith([
      { file: fileA, path: 'MyFolder' },
      { file: fileB, path: 'MyFolder/sub' },
    ])
  })

  it('ignores drag over for in-app drags without files', () => {
    setup()
    const zone = screen.getByTestId('dropzone')

    fireEvent.dragOver(zone, { dataTransfer: { types: ['text/plain'] } })

    expect(screen.queryByText('Drop files and folders to upload')).not.toBeInTheDocument()
  })

  it('hides the overlay when the drag leaves', () => {
    setup()
    const zone = screen.getByTestId('dropzone')

    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'] } })
    expect(screen.getByText('Drop files and folders to upload')).toBeInTheDocument()

    fireEvent.dragLeave(zone)
    expect(screen.queryByText('Drop files and folders to upload')).not.toBeInTheDocument()
  })

  it('ignores a drop with no files', () => {
    const { onDrop } = setup()
    const zone = screen.getByTestId('dropzone')

    fireEvent.drop(zone, { dataTransfer: { files: [] } })

    expect(onDrop).not.toHaveBeenCalled()
  })

  it('shows a progress bar while uploading', () => {
    setup({ loading: true, progress: { done: 2, total: 5 } })

    expect(screen.getByText('Uploading 2/5…')).toBeInTheDocument()
  })

  it('does nothing while loading', () => {
    const { onDrop, ref } = setup({ loading: true })
    const input = screen.getByTestId('file-input')
    const clickSpy = vi.spyOn(input, 'click')
    const zone = screen.getByTestId('dropzone')

    ref.current.open()
    expect(clickSpy).not.toHaveBeenCalled()

    fireEvent.dragOver(zone)
    expect(screen.queryByText('Drop files and folders to upload')).not.toBeInTheDocument()

    fireEvent.drop(zone, { dataTransfer: { files: [makeFile()] } })
    expect(onDrop).not.toHaveBeenCalled()
  })
})
