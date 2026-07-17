import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it('shows the backend status once the ping succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ status: 'ok', rails_env: 'test' }),
    })

    render(<App />)

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/ping')
    await waitFor(() =>
      expect(screen.getByText('ok (test)')).toBeInTheDocument(),
    )
  })

  it('shows an error message when the backend is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))

    render(<App />)

    await waitFor(() =>
      expect(screen.getByText('backend unreachable')).toBeInTheDocument(),
    )
  })

  it('increments the counter when clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ status: 'ok', rails_env: 'test' }),
    })
    const user = userEvent.setup()

    render(<App />)

    const button = screen.getByRole('button', { name: /count is 0/i })
    await user.click(button)
    expect(screen.getByRole('button', { name: /count is 1/i })).toBeInTheDocument()
  })
})
