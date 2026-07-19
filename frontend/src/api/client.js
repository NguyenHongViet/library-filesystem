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

export const adminApi = {
  listUsers: () => request('/admin/users'),
  createUser: (attrs) => request('/admin/users', { method: 'POST', body: attrs }),
  updateUser: (id, attrs) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: attrs }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
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
  folderDownloadUrl: (id) => `/api/v1/folders/${id}/download`,
  rootDownloadUrl: () => '/api/v1/folders/download_root',
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
  search: (q) => request(`/search${query({ q })}`),
  searchSharedUser: (userId, q, includePrivate) =>
    request(
      `/shared/users/${userId}/search${query({ q, include_private: includePrivate || undefined })}`,
    ),
  listSharedUsers: () => request('/shared/users'),
  listSharedEntries: (userId, parentId, includePrivate) =>
    request(
      `/shared/users/${userId}/entries${query({ parent_id: parentId, include_private: includePrivate || undefined })}`,
    ),
  sharedDocumentDownloadUrl: (id, includePrivate) =>
    `/api/v1/shared/documents/${id}/download${includePrivate ? '?include_private=true' : ''}`,
  sharedFolderDownloadUrl: (id, includePrivate) =>
    `/api/v1/shared/folders/${id}/download${includePrivate ? '?include_private=true' : ''}`,
  copySharedDocument: (id, folderId, includePrivate) =>
    request(`/shared/documents/${id}/copy`, {
      method: 'POST',
      body: { folder_id: folderId, include_private: includePrivate },
    }),
  copySharedFolder: (id, folderId, includePrivate) =>
    request(`/shared/folders/${id}/copy`, {
      method: 'POST',
      body: { folder_id: folderId, include_private: includePrivate },
    }),
  restoreDocument: (id) => request(`/documents/${id}/restore`, { method: 'POST' }),
  uploadDocument: (file, folderId, relativePath) => {
    const formData = new FormData()
    formData.append('file', file)
    if (folderId != null) formData.append('folder_id', folderId)
    if (relativePath) formData.append('relative_path', relativePath)
    return upload('/documents', formData)
  },
}
