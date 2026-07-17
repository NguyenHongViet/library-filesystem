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
import { IconLogout, IconMoon, IconSun } from '@tabler/icons-react'
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

function AdminLayout({ children }) {
  const { user, logout } = useAuth()

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>App</Title>
          <Group gap="sm">
            {user && (
              <Text size="sm" c="dimmed">
                {user.name || user.email}
              </Text>
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
