import { Card, Center, Loader, Stack, Text, Title } from '@mantine/core'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import { useAuth } from './auth/AuthContext'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <AdminLayout>
      <Stack gap="lg">
        <Title order={2}>Welcome, {user.name || user.email}</Title>
        <Card withBorder padding="lg">
          <Text c="dimmed">You are signed in. Start building your app here.</Text>
        </Card>
      </Stack>
    </AdminLayout>
  )
}

export default App
