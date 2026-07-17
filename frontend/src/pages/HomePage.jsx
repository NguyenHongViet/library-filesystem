import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconFile,
  IconFolder,
  IconUpload,
} from '@tabler/icons-react'
import { filesApi } from '../api/client'
import { formatBytes } from '../utils/format'
import FileDropzone from '../components/FileDropzone'

function HomePage() {
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const dropzoneRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [foldersData, documentsData] = await Promise.all([
        filesApi.listFolders(),
        filesApi.listDocuments(),
      ])
      setFolders(foldersData.folders)
      setDocuments(documentsData.documents)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = useCallback(
    async (files) => {
      setUploading(true)
      setError(null)
      try {
        for (const file of files) {
          await filesApi.uploadDocument(file)
        }
        await load()
      } catch (err) {
        setError(err.message)
      } finally {
        setUploading(false)
      }
    },
    [load],
  )

  const isEmpty = folders.length === 0 && documents.length === 0

  return (
    <Stack
      gap="lg"
      mih="calc(100dvh - 60px - 2 * var(--mantine-spacing-md))"
    >
      <Group justify="space-between">
        <Title order={2}>My files</Title>
        <Button
          leftSection={<IconUpload size={16} />}
          onClick={() => dropzoneRef.current?.open()}
          loading={uploading}
        >
          Upload file
        </Button>
      </Group>

      {error && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          title="Something went wrong"
        >
          {error}
        </Alert>
      )}

      <FileDropzone ref={dropzoneRef} onDrop={handleUpload} loading={uploading}>
        <Card withBorder padding="lg" mih={160} style={{ flex: 1 }}>
          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : isEmpty ? (
            <Text c="dimmed" ta="center" py="xl">
              This folder is empty. Drag files here or use the Upload button.
            </Text>
          ) : (
            <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Size</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {folders.map((folder) => (
                <Table.Tr key={`folder-${folder.id}`}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconFolder size={18} />
                      <Text>{folder.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>Folder</Table.Td>
                  <Table.Td>—</Table.Td>
                </Table.Tr>
              ))}
              {documents.map((document) => (
                <Table.Tr key={`document-${document.id}`}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconFile size={18} />
                      <Text>{document.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{document.content_type || 'File'}</Table.Td>
                  <Table.Td>{formatBytes(document.byte_size)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            </Table>
          )}
        </Card>
      </FileDropzone>
    </Stack>
  )
}

export default HomePage
