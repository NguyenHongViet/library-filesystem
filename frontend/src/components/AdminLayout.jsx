import {
  ActionIcon,
  AppShell,
  Button,
  Group,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconFiles,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconTrash,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthContext'

function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const dark = colorScheme === 'dark'

  return (
    <Tooltip label={dark ? 'Light mode' : 'Dark mode'}>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Toggle color scheme"
        onClick={toggleColorScheme}
      >
        {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  )
}

function AdminLayout({ children, view, onNavigate }) {
  const { user, logout } = useAuth()

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="lg">
            <Title order={4}>Library Filesystem</Title>
            {onNavigate && (
              <Group gap="xs">
                <Button
                  variant={view === 'files' ? 'light' : 'subtle'}
                  size="xs"
                  leftSection={<IconFiles size={16} />}
                  onClick={() => onNavigate('files')}
                >
                  My files
                </Button>
                <Button
                  variant={view === 'shared' ? 'light' : 'subtle'}
                  size="xs"
                  leftSection={<IconUsers size={16} />}
                  onClick={() => onNavigate('shared')}
                >
                  Shared files
                </Button>
                <Button
                  variant={view === 'trash' ? 'light' : 'subtle'}
                  size="xs"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => onNavigate('trash')}
                >
                  Trash
                </Button>
              </Group>
            )}
          </Group>
          <Group gap="sm">
            {user && (
              <Text size="sm" c="dimmed">
                {user.name || user.email}
              </Text>
            )}
            {user && onNavigate && (
              <Button
                variant={view === 'account' ? 'light' : 'default'}
                size="xs"
                leftSection={<IconSettings size={16} />}
                onClick={() => onNavigate('account')}
              >
                Account
              </Button>
            )}
            {user?.role === 'admin' && onNavigate && (
              <Button
                variant={view === 'users' ? 'light' : 'default'}
                size="xs"
                leftSection={<IconUsersGroup size={16} />}
                onClick={() => onNavigate('users')}
              >
                Manage users
              </Button>
            )}
            <ColorSchemeToggle />
            {user && (
              <Button
                variant="default"
                size="xs"
                leftSection={<IconLogout size={16} />}
                onClick={logout}
              >
                Sign out
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}

export default AdminLayout
