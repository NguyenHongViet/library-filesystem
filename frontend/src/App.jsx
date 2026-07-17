import { Center, Loader } from '@mantine/core'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
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
      <HomePage />
    </AdminLayout>
  )
}

export default App
