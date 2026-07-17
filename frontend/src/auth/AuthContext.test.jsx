import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { authApi } from '../api/client'

vi.mock('../api/client', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    )
  })

  it('loads the current user on mount', async () => {
    authApi.me.mockResolvedValue({ user: { id: 1, email: 'me@example.com' } })

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual({ id: 1, email: 'me@example.com' })
  })

  it('stays unauthenticated when no session exists', async () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('sets the user after login', async () => {
    authApi.me.mockRejectedValue(new Error('Unauthorized'))
    authApi.login.mockResolvedValue({ user: { id: 2, email: 'new@example.com' } })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.login('new@example.com', 'secret')
    })

    expect(authApi.login).toHaveBeenCalledWith('new@example.com', 'secret')
    expect(result.current.user).toEqual({ id: 2, email: 'new@example.com' })
  })

  it('ignores a resolved session after unmount', async () => {
    let resolveMe
    authApi.me.mockReturnValue(new Promise((resolve) => {
      resolveMe = resolve
    }))

    const { result, unmount } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)

    unmount()
    await act(async () => {
      resolveMe({ user: { id: 9, email: 'late@example.com' } })
    })

    expect(authApi.me).toHaveBeenCalledTimes(1)
  })

  it('clears the user after logout', async () => {
    authApi.me.mockResolvedValue({ user: { id: 3, email: 'out@example.com' } })
    authApi.logout.mockResolvedValue(null)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user).not.toBeNull())

    await act(async () => {
      await result.current.logout()
    })

    expect(authApi.logout).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })
})
