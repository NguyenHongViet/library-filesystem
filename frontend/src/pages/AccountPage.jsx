import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAlertCircle, IconTrash } from '@tabler/icons-react'
import { authApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'

function AccountPage() {
  const { user, deleteAccount } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const [confirmOpened, confirm] = useDisclosure(false)

  const canSubmit = currentPassword.length > 0 && newPassword.length > 0

  const handleChangePassword = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setSuccess('Your password has been changed.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLeave = async () => {
    setLeaving(true)
    setError(null)
    try {
      // On success the auth state clears and the app returns to the login page.
      await deleteAccount()
    } catch (err) {
      setError(err.message)
      setLeaving(false)
      confirm.close()
    }
  }

  return (
    <Stack gap="lg" maw={520}>
      <Title order={2}>Account</Title>
      <Text c="dimmed" size="sm">
        Signed in as {user?.email}
      </Text>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Something went wrong">
          {error}
        </Alert>
      )}
      {success && (
        <Alert color="green" withCloseButton closeButtonLabel="Dismiss" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card withBorder padding="lg">
        <Stack>
          <Title order={4}>Change password</Title>
          <PasswordInput
            label="Current password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.currentTarget.value)}
          />
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button onClick={handleChangePassword} loading={saving} disabled={!canSubmit}>
              Update password
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Stack>
          <Title order={4}>Leave</Title>
          <Text size="sm" c="dimmed">
            Deleting your account permanently removes your files and folders. This cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={16} />}
              onClick={confirm.open}
            >
              Delete my account
            </Button>
          </Group>
        </Stack>
      </Card>

      <Modal
        opened={confirmOpened}
        onClose={confirm.close}
        title="Delete account"
        centered
        transitionProps={{ duration: 0 }}
      >
        <Stack>
          <Text>
            Are you sure you want to delete your account? All of your files and folders will be
            permanently removed. This cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={confirm.close}>
              Cancel
            </Button>
            <Button color="red" onClick={handleLeave} loading={leaving}>
              Delete account
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default AccountPage
