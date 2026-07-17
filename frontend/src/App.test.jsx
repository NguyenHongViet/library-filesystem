import { describe, expect, it } from 'vitest'
import { renderWithMantine, screen } from './test-utils'
import App from './App'

describe('App', () => {
  it('renders the welcome content', () => {
    renderWithMantine(<App />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Welcome' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Start building your app here.')).toBeInTheDocument()
  })
})
