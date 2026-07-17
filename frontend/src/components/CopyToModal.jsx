import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { IconAlertCircle, IconChevronRight, IconFolder } from '@tabler/icons-react'
import { filesApi } from '../api/client'

// Lets the user pick a destination folder in their own library, then confirms
// the copy into the folder currently being viewed.
function CopyToModal({ opened, targetName, onClose, onConfirm, loading = false }) {
  const [path, setPath] = useState([])
  const [folders, setFolders] = useState([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [error, setError] = useState(null)

  const parentId = path.length > 0 ? path[path.length - 1].id : null

  useEffect(() => {
    if (opened) setPath([])
  }, [opened])

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true)
    setError(null)
    try {
      const data = await filesApi.listFolders(parentId)
      setFolders(data.folders)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFolders(false)
    }
  }, [parentId])

  useEffect(() => {
    if (opened) loadFolders()
  }, [opened, loadFolders])

  const currentName = path.length > 0 ? path[path.length - 1].name : 'My files'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Copy "${targetName}" to…`}
      centered
      transitionProps={{ duration: 0 }}
    >
      <Stack>
        <Breadcrumbs>
          <Anchor component="button" type="button" onClick={() => setPath([])}>
            My files
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

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        <Stack gap="xs" mih={120}>
          {loadingFolders ? (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          ) : folders.length === 0 ? (
            <Text c="dimmed" ta="center" py="md" size="sm">
              No subfolders here.
            </Text>
          ) : (
            folders.map((folder) => (
              <UnstyledButton
                key={folder.id}
                data-testid={`dest-folder-${folder.id}`}
                onClick={() => setPath([...path, { id: folder.id, name: folder.name }])}
              >
                <Group gap="xs" wrap="nowrap">
                  <IconFolder size={18} />
                  <Text>{folder.name}</Text>
                  <IconChevronRight size={14} style={{ marginLeft: 'auto' }} />
                </Group>
              </UnstyledButton>
            ))
          )}
        </Stack>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Destination: {currentName}
          </Text>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onConfirm(parentId)} loading={loading}>
              Copy here
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}

export default CopyToModal
