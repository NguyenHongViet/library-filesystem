import { useState } from 'react'
import { Center, Loader } from '@mantine/core'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import TrashPage from './pages/TrashPage'
import SharedPage from './pages/SharedPage'
import { useAuth } from './auth/AuthContext'

function App() {
  const { user, loading } = useAuth()
  const [view, setView] = useState('files')

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
    <AdminLayout view={view} onNavigate={setView}>
      {view === 'trash' ? (
        <TrashPage />
      ) : view === 'shared' ? (
        <SharedPage />
      ) : (
        <HomePage />
      )}
    </AdminLayout>
  )
}

export default App
