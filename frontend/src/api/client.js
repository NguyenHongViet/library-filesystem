const jsonHeaders = { 'Content-Type': 'application/json' }

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: jsonHeaders,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json')
  const data = isJson ? await response.json() : null

  if (!response.ok) {
    const message = data?.error || 'Something went wrong. Please try again.'
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export const authApi = {
  login: (email, password) =>
    request('/login', { method: 'POST', body: { user: { email, password } } }),
  logout: () => request('/logout', { method: 'DELETE' }),
  me: () => request('/me'),
}
