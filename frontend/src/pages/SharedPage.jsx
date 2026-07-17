import { useCallback, useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Breadcrumbs,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconFile,
  IconFolder,
  IconUser,
} from '@tabler/icons-react'
import { filesApi } from '../api/client'
import { formatBytes } from '../utils/format'

function displayName(user) {
  return user.name || user.email
}

function SharedPage() {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [path, setPath] = useState([])
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const parentId = path.length > 0 ? path[path.length - 1].id : null

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await filesApi.listSharedUsers()
      setUsers(data.users)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await filesApi.listSharedEntries(selectedUser.id, parentId)
      setFolders(data.folders)
      setDocuments(data.documents)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedUser, parentId])

  useEffect(() => {
    if (selectedUser) {
      loadEntries()
    } else {
      loadUsers()
    }
  }, [selectedUser, loadEntries, loadUsers])

  const openUser = (user) => {
    setPath([])
    setSelectedUser(user)
  }

  const backToUsers = () => {
    setSelectedUser(null)
    setPath([])
  }

  if (!selectedUser) {
    return (
      <Stack gap="lg">
        <Title order={2}>Shared files</Title>
        <Text c="dimmed" size="sm">
          Pick a user to browse the files and folders they have made public.
        </Text>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Something went wrong">
            {error}
          </Alert>
        )}

        <Card withBorder padding="lg" mih={160}>
          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : users.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              There are no other users yet.
            </Text>
          ) : (
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Email</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr
                    key={user.id}
                    data-testid={`shared-user-${user.id}`}
                    onClick={() => openUser(user)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <IconUser size={18} />
                        <Text>{displayName(user)}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>
    )
  }

  const isEmpty = folders.length === 0 && documents.length === 0

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component="button" type="button" onClick={backToUsers}>
          Shared files
        </Anchor>
        <Anchor component="button" type="button" onClick={() => setPath([])}>
          {displayName(selectedUser)}
        </Anchor>
        {path.map((folder, index) =>
          index === path.length - 1 ? (
            <Text key={folder.id} fw={500}>
              {folder.name}
            </Text>
          ) : (
            <Anchor
              key={folder.id}
              component="button"
              type="button"
              onClick={() => setPath(path.slice(0, index + 1))}
            >
              {folder.name}
            </Anchor>
          ),
        )}
      </Breadcrumbs>

      <Title order={2}>
        {path.length > 0 ? path[path.length - 1].name : displayName(selectedUser)}
      </Title>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Something went wrong">
          {error}
        </Alert>
      )}

      <Card withBorder padding="lg" mih={160}>
        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : isEmpty ? (
          <Text c="dimmed" ta="center" py="xl">
            Nothing shared here.
          </Text>
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {folders.map((folder) => (
                <Table.Tr
                  key={`folder-${folder.id}`}
                  data-testid={`shared-folder-${folder.id}`}
                  onClick={() => setPath([...path, { id: folder.id, name: folder.name }])}
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
                  <Table.Td />
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
                  <Table.Td ta="right">
                    <Tooltip label="Download" withArrow>
                      <ActionIcon
                        component="a"
                        href={filesApi.sharedDocumentDownloadUrl(document.id)}
                        variant="subtle"
                        aria-label={`Download ${document.name}`}
                      >
                        <IconDownload size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  )
}

export default SharedPage
