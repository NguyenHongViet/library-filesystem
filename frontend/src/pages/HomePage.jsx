import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconFile,
  IconFolder,
  IconFolderPlus,
  IconUpload,
} from '@tabler/icons-react'
import { filesApi } from '../api/client'
import { formatBytes } from '../utils/format'
import FileDropzone from '../components/FileDropzone'

function HomePage() {
  const [folderId, setFolderId] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([])
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [dropTargetId, setDropTargetId] = useState(null)
  const [modalOpened, modal] = useDisclosure(false)
  const draggingIdRef = useRef(null)
  const dropzoneRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [foldersData, documentsData, folderData] = await Promise.all([
        filesApi.listFolders(folderId),
        filesApi.listDocuments(folderId),
        folderId ? filesApi.getFolder(folderId) : Promise.resolve(null),
      ])
      setFolders(foldersData.folders)
      setDocuments(documentsData.documents)
      setBreadcrumb(folderData ? folderData.breadcrumb : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [folderId])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = useCallback(
    async (files) => {
      setUploading(true)
      setError(null)
      try {
        for (const file of files) {
          await filesApi.uploadDocument(file, folderId)
        }
        await load()
      } catch (err) {
        setError(err.message)
      } finally {
        setUploading(false)
      }
    },
    [folderId, load],
  )

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      await filesApi.createFolder(name, folderId)
      setNewFolderName('')
      modal.close()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }, [newFolderName, folderId, load, modal])

  const handleMove = useCallback(
    async (targetFolderId) => {
      const documentId = draggingIdRef.current
      draggingIdRef.current = null
      setDropTargetId(null)
      if (documentId == null) return
      setError(null)
      try {
        await filesApi.moveDocument(documentId, targetFolderId)
        await load()
      } catch (err) {
        setError(err.message)
      }
    },
    [load],
  )

  const isEmpty = folders.length === 0 && documents.length === 0

  return (
    <Stack gap="lg" mih="calc(100dvh - 60px - 2 * var(--mantine-spacing-md))">
      <Breadcrumbs>
        <Anchor component="button" type="button" onClick={() => setFolderId(null)}>
          My files
        </Anchor>
        {breadcrumb.map((folder, index) =>
          index === breadcrumb.length - 1 ? (
            <Text key={folder.id} fw={500}>
              {folder.name}
            </Text>
          ) : (
            <Anchor
              key={folder.id}
              component="button"
              type="button"
              onClick={() => setFolderId(folder.id)}
            >
              {folder.name}
            </Anchor>
          ),
        )}
      </Breadcrumbs>

      <Group justify="space-between">
        <Title order={2}>
          {breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : 'My files'}
        </Title>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconFolderPlus size={16} />}
            onClick={modal.open}
          >
            New folder
          </Button>
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={() => dropzoneRef.current?.open()}
            loading={uploading}
          >
            Upload file
          </Button>
        </Group>
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
                  <Table.Tr
                    key={`folder-${folder.id}`}
                    data-testid={`folder-row-${folder.id}`}
                    onClick={() => setFolderId(folder.id)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDropTargetId(folder.id)
                    }}
                    onDragLeave={() =>
                      setDropTargetId((current) =>
                        current === folder.id ? null : current,
                      )
                    }
                    onDrop={(event) => {
                      event.preventDefault()
                      handleMove(folder.id)
                    }}
                    bg={
                      dropTargetId === folder.id
                        ? 'var(--mantine-color-blue-light)'
                        : undefined
                    }
                    style={{ cursor: 'pointer' }}
                  >
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
                  <Table.Tr
                    key={`document-${document.id}`}
                    data-testid={`document-row-${document.id}`}
                    draggable
                    onDragStart={() => {
                      draggingIdRef.current = document.id
                    }}
                    onDragEnd={() => {
                      draggingIdRef.current = null
                      setDropTargetId(null)
                    }}
                    style={{ cursor: 'grab' }}
                  >
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

      <Modal
        opened={modalOpened}
        onClose={modal.close}
        title="New folder"
        centered
        transitionProps={{ duration: 0 }}
      >
        <Stack>
          <TextInput
            label="Folder name"
            placeholder="e.g. Reports"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateFolder()
            }}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={modal.close}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              loading={creating}
              disabled={newFolderName.trim().length === 0}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default HomePage
