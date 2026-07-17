import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { theme } from './theme'
import { AuthProvider } from './auth/AuthContext'

export function renderWithMantine(ui, options) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider theme={theme}>{children}</MantineProvider>
    ),
    ...options,
  })
}

export function renderWithProviders(ui, options) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider theme={theme}>
        <AuthProvider>{children}</AuthProvider>
      </MantineProvider>
    ),
    ...options,
  })
}

export { screen, waitFor, within } from '@testing-library/react'
