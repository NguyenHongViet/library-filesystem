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
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCopy,
  IconDownload,
  IconFile,
  IconFolder,
  IconSearch,
  IconUser,
} from '@tabler/icons-react'
import { filesApi } from '../api/client'
import { formatBytes } from '../utils/format'
import CopyToModal from '../components/CopyToModal'

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
  const [copyTarget, setCopyTarget] = useState(null)
  const [copying, setCopying] = useState(false)
  const [notice, setNotice] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

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

  useEffect(() => {
    const query = searchQuery.trim()
    if (!selectedUser || !query) {
      setSearchResults(null)
      return undefined
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        setSearchResults(await filesApi.searchSharedUser(selectedUser.id, query))
      } catch (err) {
        setError(err.message)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedUser, searchQuery])

  // Navigating anywhere leaves search mode.
  const navigate = (newPath) => {
    setSearchQuery('')
    setPath(newPath)
  }

  const openUser = (user) => {
    setSearchQuery('')
    setPath([])
    setSelectedUser(user)
  }

  const backToUsers = () => {
    setSearchQuery('')
    setSelectedUser(null)
    setPath([])
  }

  const handleConfirmCopy = useCallback(
    async (destinationFolderId) => {
      if (!copyTarget) return
      setCopying(true)
      setError(null)
      try {
        if (copyTarget.type === 'folder') {
          await filesApi.copySharedFolder(copyTarget.id, destinationFolderId)
        } else {
          await filesApi.copySharedDocument(copyTarget.id, destinationFolderId)
        }
        setNotice(`Copied "${copyTarget.name}" to your library.`)
        setCopyTarget(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setCopying(false)
      }
    },
    [copyTarget],
  )

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
  const isSearching = searchQuery.trim().length > 0
  const searchHasResults =
    searchResults &&
    (searchResults.folders.length > 0 || searchResults.documents.length > 0)

  const renderEntries = (folderList, documentList, onFolderClick) => (
    <Table verticalSpacing="sm" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Size</Table.Th>
          <Table.Th w={110} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {folderList.map((folder) => (
          <Table.Tr
            key={`folder-${folder.id}`}
            data-testid={`shared-folder-${folder.id}`}
            onClick={() => onFolderClick(folder)}
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
            <Table.Td ta="right">
              <Group gap="xs" justify="flex-end" wrap="nowrap">
                <Tooltip label="Copy to my files" withArrow>
                  <ActionIcon
                    variant="subtle"
                    aria-label={`Copy ${folder.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setCopyTarget({ type: 'folder', id: folder.id, name: folder.name })
                    }}
                  >
                    <IconCopy size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Download" withArrow>
                  <ActionIcon
                    component="a"
                    href={filesApi.sharedFolderDownloadUrl(folder.id)}
                    variant="subtle"
                    aria-label={`Download ${folder.name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <IconDownload size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
        {documentList.map((document) => (
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
              <Group gap="xs" justify="flex-end" wrap="nowrap">
                <Tooltip label="Copy to my files" withArrow>
                  <ActionIcon
                    variant="subtle"
                    aria-label={`Copy ${document.name}`}
                    onClick={() =>
                      setCopyTarget({ type: 'document', id: document.id, name: document.name })
                    }
                  >
                    <IconCopy size={16} />
                  </ActionIcon>
                </Tooltip>
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
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component="button" type="button" onClick={backToUsers}>
          Shared files
        </Anchor>
        <Anchor component="button" type="button" onClick={() => navigate([])}>
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
              onClick={() => navigate(path.slice(0, index + 1))}
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

      {notice && (
        <Alert
          color="green"
          title="Copied"
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={() => setNotice(null)}
        >
          {notice}
        </Alert>
      )}

      <TextInput
        placeholder={`Search ${displayName(selectedUser)}'s shared files by name`}
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
        aria-label="Search shared files"
      />

      <Card withBorder padding="lg" mih={160}>
        {isSearching ? (
          searching ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : !searchHasResults ? (
            <Text c="dimmed" ta="center" py="xl">
              No matches for “{searchQuery.trim()}”.
            </Text>
          ) : (
            renderEntries(searchResults.folders, searchResults.documents, (folder) =>
              navigate([{ id: folder.id, name: folder.name }]),
            )
          )
        ) : loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : isEmpty ? (
          <Text c="dimmed" ta="center" py="xl">
            Nothing shared here.
          </Text>
        ) : (
          renderEntries(folders, documents, (folder) =>
            navigate([...path, { id: folder.id, name: folder.name }]),
          )
        )}
      </Card>

      <CopyToModal
        opened={copyTarget != null}
        targetName={copyTarget?.name || ''}
        loading={copying}
        onClose={() => setCopyTarget(null)}
        onConfirm={handleConfirmCopy}
      />
    </Stack>
  )
}

export default SharedPage
