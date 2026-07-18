import { useCallback, useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconEdit, IconTrash, IconUserPlus } from '@tabler/icons-react'
import { adminApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = { email: '', name: '', role: 'member', password: '' }

function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modalOpened, setModalOpened] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.listUsers()
      setUsers(data.users)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpened(true)
  }

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({ email: user.email, name: user.name || '', role: user.role, password: '' })
    setFormError(null)
    setModalOpened(true)
  }

  const updateField = (field) => (event) => {
    const value = event?.currentTarget ? event.currentTarget.value : event
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = useCallback(async () => {
    setSaving(true)
    setFormError(null)
    const attrs = {
      email: form.email,
      name: form.name,
      role: form.role,
    }
    if (form.password) attrs.password = form.password
    try {
      if (editingUser) {
        await adminApi.updateUser(editingUser.id, attrs)
      } else {
        await adminApi.createUser({ ...attrs, password: form.password })
      }
      setModalOpened(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }, [editingUser, form, load])

  const handleDelete = useCallback(
    async (user) => {
      setError(null)
      try {
        await adminApi.deleteUser(user.id)
        await load()
      } catch (err) {
        setError(err.message)
      }
    },
    [load],
  )

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Manage users</Title>
        <Button leftSection={<IconUserPlus size={16} />} onClick={openCreate}>
          New user
        </Button>
      </Group>

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
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Email</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user.id} data-testid={`user-row-${user.id}`}>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>{user.name || '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={user.role === 'admin' ? 'grape' : 'gray'} variant="light">
                      {user.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Tooltip label="Edit" withArrow>
                        <ActionIcon
                          variant="subtle"
                          aria-label={`Edit ${user.email}`}
                          onClick={() => openEdit(user)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip
                        label={user.id === currentUser?.id ? 'You cannot delete yourself' : 'Delete'}
                        withArrow
                      >
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Delete ${user.email}`}
                          disabled={user.id === currentUser?.id}
                          onClick={() => handleDelete(user)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingUser ? 'Edit user' : 'New user'}
        centered
        transitionProps={{ duration: 0 }}
      >
        <Stack>
          {formError && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {formError}
            </Alert>
          )}
          <TextInput
            label="Email"
            value={form.email}
            onChange={updateField('email')}
            required
            data-autofocus
          />
          <TextInput label="Name" value={form.name} onChange={updateField('name')} />
          <Select
            label="Role"
            data={[
              { value: 'member', label: 'Member' },
              { value: 'admin', label: 'Admin' },
            ]}
            value={form.role}
            onChange={updateField('role')}
            allowDeselect={false}
          />
          <PasswordInput
            label={editingUser ? 'New password' : 'Password'}
            description={editingUser ? 'Leave blank to keep the current password.' : undefined}
            value={form.password}
            onChange={updateField('password')}
            required={!editingUser}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingUser ? 'Save' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default UsersPage
