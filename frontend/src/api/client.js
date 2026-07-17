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

async function upload(path, formData) {
  const response = await fetch(`/api/v1${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json')
  const data = isJson ? await response.json() : null

  if (!response.ok) {
    const message = data?.errors?.join(' ') || data?.error || 'Upload failed. Please try again.'
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

function query(params) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null),
  ).toString()
  return search ? `?${search}` : ''
}

export const filesApi = {
  listDocuments: (folderId) =>
    request(`/documents${query({ folder_id: folderId })}`),
  getDocument: (id) => request(`/documents/${id}`),
  restoreVersion: (id, versionId) =>
    request(`/documents/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  documentDownloadUrl: (id) => `/api/v1/documents/${id}/download`,
  versionDownloadUrl: (id, versionId) =>
    `/api/v1/documents/${id}/versions/${versionId}/download`,
  listFolders: (parentId) =>
    request(`/folders${query({ parent_id: parentId })}`),
  getFolder: (id) => request(`/folders/${id}`),
  createFolder: (name, parentId) =>
    request('/folders', { method: 'POST', body: { name, parent_id: parentId } }),
  moveDocument: (id, folderId) =>
    request(`/documents/${id}`, { method: 'PATCH', body: { folder_id: folderId } }),
  setFolderPublic: (id, isPublic) =>
    request(`/folders/${id}`, { method: 'PATCH', body: { is_public: isPublic } }),
  setDocumentPublic: (id, isPublic) =>
    request(`/documents/${id}`, { method: 'PATCH', body: { is_public: isPublic } }),
  deleteFolder: (id) => request(`/folders/${id}`, { method: 'DELETE' }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  listTrash: () => request('/trash'),
  listSharedUsers: () => request('/shared/users'),
  listSharedEntries: (userId, parentId) =>
    request(`/shared/users/${userId}/entries${query({ parent_id: parentId })}`),
  restoreDocument: (id) => request(`/documents/${id}/restore`, { method: 'POST' }),
  uploadDocument: (file, folderId) => {
    const formData = new FormData()
    formData.append('file', file)
    if (folderId != null) formData.append('folder_id', folderId)
    return upload('/documents', formData)
  },
}
