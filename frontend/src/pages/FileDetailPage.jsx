import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Anchor,
  Badge,
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
  IconArrowLeft,
  IconDownload,
  IconFile,
} from '@tabler/icons-react'
import { filesApi } from '../api/client'
import { formatBytes } from '../utils/format'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function FileDetailPage({ documentId, onBack }) {
  const [document, setDocument] = useState(null)
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await filesApi.getDocument(documentId)
      setDocument(data.document)
      setVersions(data.versions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    load()
  }, [load])

  const handleRestore = useCallback(
    async (version) => {
      setRestoringId(version.id)
      setError(null)
      try {
        const data = await filesApi.restoreVersion(documentId, version.id)
        setDocument(data.document)
        setVersions(data.versions)
      } catch (err) {
        setError(err.message)
      } finally {
        setRestoringId(null)
      }
    },
    [documentId],
  )

  return (
    <Stack gap="lg">
      <Anchor component="button" type="button" onClick={onBack} w="fit-content">
        <Group gap={4}>
          <IconArrowLeft size={16} />
          <Text>Back to files</Text>
        </Group>
      </Anchor>

      {error && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          title="Something went wrong"
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : document ? (
        <>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm">
              <IconFile size={28} />
              <Title order={2}>{document.name}</Title>
              <Badge color={document.is_public ? 'green' : 'gray'} variant="light">
                {document.is_public ? 'Public' : 'Private'}
              </Badge>
            </Group>
            <Button
              component="a"
              href={filesApi.documentDownloadUrl(document.id)}
              variant="default"
              leftSection={<IconDownload size={16} />}
            >
              Download
            </Button>
          </Group>

          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text c="dimmed">Location</Text>
                <Text>{document.location || 'My files'}</Text>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed">Type</Text>
                <Text>{document.content_type || 'File'}</Text>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed">Size</Text>
                <Text>{formatBytes(document.byte_size)}</Text>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed">Last updated</Text>
                <Text>{formatDate(document.updated_at)}</Text>
              </Group>
            </Stack>
          </Card>

          <Title order={3}>Version history</Title>
          <Text c="dimmed" size="sm">
            The current file plus its most recent versions are kept. Restore a version
            to make it the current file — the current one is saved as a new version.
          </Text>

          <Card withBorder padding="lg">
            {versions.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                This file has no earlier versions yet.
              </Text>
            ) : (
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Saved</Table.Th>
                    <Table.Th w={220} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {versions.map((version) => (
                    <Table.Tr key={version.id}>
                      <Table.Td>v{version.version_number}</Table.Td>
                      <Table.Td>{version.content_type || 'File'}</Table.Td>
                      <Table.Td>{formatBytes(version.byte_size)}</Table.Td>
                      <Table.Td>{formatDate(version.created_at)}</Table.Td>
                      <Table.Td ta="right">
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          <Button
                            component="a"
                            href={filesApi.versionDownloadUrl(document.id, version.id)}
                            variant="subtle"
                            size="compact-sm"
                            leftSection={<IconDownload size={16} />}
                          >
                            Download
                          </Button>
                          <Button
                            variant="subtle"
                            size="compact-sm"
                            leftSection={<IconArrowBackUp size={16} />}
                            loading={restoringId === version.id}
                            onClick={() => handleRestore(version)}
                          >
                            Restore
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </>
      ) : null}
    </Stack>
  )
}

export default FileDetailPage
