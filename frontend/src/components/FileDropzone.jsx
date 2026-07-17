import { useImperativeHandle, useRef, useState } from 'react'
import { Box, LoadingOverlay, Overlay, Stack, Text } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'

function FileDropzone({ onDrop, loading = false, children, ref }) {
  const inputRef = useRef(null)
  const [active, setActive] = useState(false)

  const open = () => {
    if (!loading) inputRef.current?.click()
  }

  useImperativeHandle(ref, () => ({ open }))

  const emit = (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length > 0) onDrop(files)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setActive(false)
    if (loading) return
    emit(event.dataTransfer.files)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    if (!loading) setActive(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    setActive(false)
  }

  const handleInputChange = (event) => {
    emit(event.currentTarget.files)
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
        ref={inputRef}
        type="file"
        multiple
        hidden
        aria-hidden="true"
        data-testid="file-input"
        onChange={handleInputChange}
      />

      <LoadingOverlay
        visible={loading}
        overlayProps={{ radius: 'md', blur: 1 }}
        loaderProps={{ children: <Text fw={600}>Uploading…</Text> }}
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
            <Text fw={600}>Drop files to upload</Text>
          </Stack>
        </Overlay>
      )}
    </Box>
  )
}

export default FileDropzone
