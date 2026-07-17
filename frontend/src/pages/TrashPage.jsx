import { useCallback, useEffect, useState } from 'react'
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
  IconArrowBackUp,
  IconFile,
} from '@tabler/icons-react'
import { filesApi } from '../api/client'
import { formatBytes } from '../utils/format'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function TrashPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await filesApi.listTrash()
      setDocuments(data.documents)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRestore = useCallback(
    async (document) => {
      setError(null)
      try {
        await filesApi.restoreDocument(document.id)
        await load()
      } catch (err) {
        setError(err.message)
      }
    },
    [load],
  )

  const isEmpty = documents.length === 0

  return (
    <Stack gap="lg">
      <Title order={2}>Trash</Title>

      <Text c="dimmed" size="sm">
        Deleted files are kept here for 30 days before they are permanently removed.
        Restoring a file recreates its original folders if they no longer exist.
      </Text>

      {error && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          title="Something went wrong"
        >
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
            The trash is empty.
          </Text>
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Original location</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Deleted</Table.Th>
                <Table.Th w={120} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {documents.map((document) => (
                <Table.Tr key={document.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconFile size={18} />
                      <Text>{document.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text c="dimmed">{document.deleted_path || 'My files'}</Text>
                  </Table.Td>
                  <Table.Td>{formatBytes(document.byte_size)}</Table.Td>
                  <Table.Td>{formatDate(document.deleted_at)}</Table.Td>
                  <Table.Td ta="right">
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      leftSection={<IconArrowBackUp size={16} />}
                      onClick={() => handleRestore(document)}
                    >
                      Restore
                    </Button>
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

export default TrashPage
