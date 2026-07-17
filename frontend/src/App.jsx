import { Card, Stack, Text, Title } from '@mantine/core'
import AdminLayout from './components/AdminLayout'

function App() {
  return (
    <AdminLayout>
      <Stack gap="lg">
        <Title order={2}>Welcome</Title>
        <Card withBorder padding="lg">
          <Text c="dimmed">Start building your app here.</Text>
        </Card>
      </Stack>
    </AdminLayout>
  )
}

export default App
