import { useImperativeHandle, useRef, useState } from 'react'
import { Box, LoadingOverlay, Overlay, Progress, Stack, Text } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'

// Normalize a FileList (from an <input>) into { file, path } items. For a
// directory pick, webkitRelativePath holds the file's path within the folder.
function itemsFromFileList(fileList) {
  return Array.from(fileList || []).map((file) => {
    const parts = (file.webkitRelativePath || '').split('/')
    parts.pop() // drop the filename, keep the directory path
    return { file, path: parts.join('/') }
  })
}

function readAllEntries(reader) {
  return new Promise((resolve, reject) => {
    const entries = []
    const readBatch = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(entries)
        else {
          entries.push(...batch)
          readBatch()
        }
      }, reject)
    readBatch()
  })
}

// Recursively collect files from a dropped filesystem entry, tracking the
// directory path each file lives in so the structure can be recreated.
async function collectEntry(entry, dirPath) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject))
    return [{ file, path: dirPath }]
  }
  const childDir = dirPath ? `${dirPath}/${entry.name}` : entry.name
  const children = await readAllEntries(entry.createReader())
  const collected = []
  for (const child of children) {
    collected.push(...(await collectEntry(child, childDir)))
  }
  return collected
}

function UploadingIndicator({ progress }) {
  if (!progress || progress.total === 0) {
    return <Text fw={600}>Uploading…</Text>
  }
  const percent = Math.round((progress.done / progress.total) * 100)
  return (
    <Stack align="center" gap="xs" w={220}>
      <Text fw={600}>
        Uploading {progress.done}/{progress.total}…
      </Text>
      <Progress value={percent} w="100%" aria-label="Upload progress" />
    </Stack>
  )
}

function FileDropzone({ onDrop, loading = false, progress = null, children, ref }) {
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const [active, setActive] = useState(false)

  const open = () => {
    if (!loading) fileInputRef.current?.click()
  }

  const openFolder = () => {
    if (!loading) folderInputRef.current?.click()
  }

  useImperativeHandle(ref, () => ({ open, openFolder }))

  const emit = (items) => {
    if (items.length > 0) onDrop(items)
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setActive(false)
    if (loading) return

    const transfer = event.dataTransfer
    // Capture entries synchronously — the DataTransfer is invalid after await.
    const entries = transfer?.items
      ? Array.from(transfer.items)
          .map((item) => item.webkitGetAsEntry?.())
          .filter(Boolean)
      : []

    if (entries.length === 0) {
      emit(itemsFromFileList(transfer?.files))
      return
    }

    const items = []
    for (const entry of entries) {
      items.push(...(await collectEntry(entry, '')))
    }
    emit(items)
  }

  // Ignore in-app drags (e.g. moving a document row); only react to OS file drags.
  const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files')

  const handleDragOver = (event) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    if (!loading) setActive(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    setActive(false)
  }

  const handleInputChange = (event) => {
    emit(itemsFromFileList(event.currentTarget.files))
    event.currentTarget.value = ''
  }

  return (
    <Box
      pos="relative"
      data-testid="dropzone"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        aria-hidden="true"
        data-testid="file-input"
        onChange={handleInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        webkitdirectory=""
        hidden
        aria-hidden="true"
        data-testid="folder-input"
        onChange={handleInputChange}
      />

      <LoadingOverlay
        visible={loading}
        overlayProps={{ radius: 'md', blur: 1 }}
        loaderProps={{ children: <UploadingIndicator progress={progress} /> }}
      />

      {children}

      {active && (
        <Overlay
          backgroundOpacity={0.1}
          color="var(--mantine-color-blue-6)"
          zIndex={200}
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            border: '2px dashed var(--mantine-color-blue-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Stack align="center" gap="xs">
            <IconUpload size={40} stroke={1.5} />
            <Text fw={600}>Drop files and folders to upload</Text>
          </Stack>
        </Overlay>
      )}
    </Box>
  )
}

export default FileDropzone
