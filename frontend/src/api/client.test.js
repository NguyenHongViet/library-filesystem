import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from './client'

function mockResponse({ ok = true, status = 200, json = null, contentType = 'application/json' }) {
  return {
    ok,
    status,
    headers: { get: () => contentType },
    json: () => Promise.resolve(json),
  }
}

describe('authApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs in with the wrapped user payload', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { user: { id: 1, email: 'a@example.com' } } }),
    )

    const data = await authApi.login('a@example.com', 'secret')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ user: { email: 'a@example.com', password: 'secret' } }),
      }),
    )
    expect(data.user.email).toBe('a@example.com')
  })

  it('fetches the current user', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { user: { id: 2 } } }))

    const data = await authApi.me()

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/me', expect.objectContaining({ method: 'GET' }))
    expect(data.user.id).toBe(2)
  })

  it('logs out with no response body', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ status: 204, json: null, contentType: null }),
    )

    await expect(authApi.logout()).resolves.toBeNull()
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/logout', expect.objectContaining({ method: 'DELETE' }))
  })

  it('throws with the server error message on failure', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 401, json: { error: 'Invalid email or password.' } }),
    )

    await expect(authApi.login('a@example.com', 'bad')).rejects.toMatchObject({
      message: 'Invalid email or password.',
      status: 401,
    })
  })

  it('throws a generic message when no error body is returned', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 500, json: null, contentType: null }),
    )

    await expect(authApi.me()).rejects.toThrow('Something went wrong. Please try again.')
  })
})
