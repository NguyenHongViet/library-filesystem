import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi, filesApi } from './client'

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

describe('filesApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists root documents without query params', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { documents: [] } }))

    await filesApi.listDocuments()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('fetches a single document with its versions', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { document: { id: 8 }, versions: [] } }),
    )

    await filesApi.getDocument(8)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents/8',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('restores a document version', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { document: { id: 8 }, versions: [] } }),
    )

    await filesApi.restoreVersion(8, 3)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents/8/versions/3/restore',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('builds download URLs for a document and a version', () => {
    expect(filesApi.documentDownloadUrl(8)).toBe('/api/v1/documents/8/download')
    expect(filesApi.versionDownloadUrl(8, 3)).toBe(
      '/api/v1/documents/8/versions/3/download',
    )
  })

  it('builds download URLs for shared items', () => {
    expect(filesApi.sharedDocumentDownloadUrl(9)).toBe(
      '/api/v1/shared/documents/9/download',
    )
    expect(filesApi.sharedFolderDownloadUrl(4)).toBe(
      '/api/v1/shared/folders/4/download',
    )
  })

  it('builds download URLs for a folder and the root', () => {
    expect(filesApi.folderDownloadUrl(4)).toBe('/api/v1/folders/4/download')
    expect(filesApi.rootDownloadUrl()).toBe('/api/v1/folders/download_root')
  })

  it('copies a shared document into a chosen folder', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 201, json: { document: { id: 1 } } }))

    await filesApi.copySharedDocument(9, 4)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/shared/documents/9/copy',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ folder_id: 4 }) }),
    )
  })

  it('copies a shared folder into the root', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 201, json: { folder: { id: 2 } } }))

    await filesApi.copySharedFolder(5, null)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/shared/folders/5/copy',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ folder_id: null }) }),
    )
  })

  it('lists documents scoped to a folder', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { documents: [] } }))

    await filesApi.listDocuments(7)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents?folder_id=7',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('lists root folders', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { folders: [] } }))

    await filesApi.listFolders()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/folders',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('fetches a single folder with its breadcrumb', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { folder: { id: 4 }, breadcrumb: [] } }),
    )

    await filesApi.getFolder(4)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/folders/4',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('creates a folder with a name and parent', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ status: 201, json: { folder: { id: 9 } } }),
    )

    await filesApi.createFolder('Reports', 2)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/folders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Reports', parent_id: 2 }),
      }),
    )
  })

  it('moves a document into a folder', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { document: { id: 5, folder_id: 3 } } }),
    )

    await filesApi.moveDocument(5, 3)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents/5',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ folder_id: 3 }),
      }),
    )
  })

  it('toggles the public flag on a folder', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { folder: { id: 4, is_public: true } } }),
    )

    await filesApi.setFolderPublic(4, true)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/folders/4',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_public: true }),
      }),
    )
  })

  it('toggles the public flag on a document', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { document: { id: 5, is_public: false } } }),
    )

    await filesApi.setDocumentPublic(5, false)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents/5',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_public: false }),
      }),
    )
  })

  it('soft deletes a folder', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ status: 204, json: null, contentType: null }),
    )

    await filesApi.deleteFolder(4)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/folders/4',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('soft deletes a document', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ status: 204, json: null, contentType: null }),
    )

    await filesApi.deleteDocument(5)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents/5',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('lists the trash', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ json: { folders: [], documents: [] } }),
    )

    await filesApi.listTrash()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/trash',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('restores a document', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { document: { id: 5 } } }))

    await filesApi.restoreDocument(5)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/documents/5/restore',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('lists users who have shared files', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { users: [] } }))

    await filesApi.listSharedUsers()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/shared/users',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('searches the whole library by name', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { folders: [], documents: [] } }))

    await filesApi.search('report')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/search?q=report',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('searches a single shared user by name', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { folders: [], documents: [] } }))

    await filesApi.searchSharedUser(7, 'report')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/shared/users/7/search?q=report',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('lists a user\'s shared entries at the root', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { folders: [], documents: [] } }))

    await filesApi.listSharedEntries(7)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/shared/users/7/entries',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('lists a user\'s shared entries within a folder', async () => {
    global.fetch.mockResolvedValue(mockResponse({ json: { folders: [], documents: [] } }))

    await filesApi.listSharedEntries(7, 3)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/shared/users/7/entries?parent_id=3',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('uploads a file as multipart form data', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ status: 201, json: { document: { id: 1, name: 'a.txt' } } }),
    )
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })

    const data = await filesApi.uploadDocument(file)

    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/v1/documents')
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('include')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('folder_id')).toBeNull()
    expect(data.document.name).toBe('a.txt')
  })

  it('sends folder_id when uploading into a folder', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ status: 201, json: { document: { id: 2 } } }),
    )
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })

    await filesApi.uploadDocument(file, 3)

    const [, options] = global.fetch.mock.calls[0]
    expect(options.body.get('folder_id')).toBe('3')
  })

  it('sends relative_path when uploading a file inside a folder tree', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ status: 201, json: { document: { id: 3 } } }),
    )
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })

    await filesApi.uploadDocument(file, 3, 'MyFolder/Sub')

    const [, options] = global.fetch.mock.calls[0]
    expect(options.body.get('relative_path')).toBe('MyFolder/Sub')
  })

  it('surfaces validation errors joined into one message', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 422, json: { errors: ['File is required.'] } }),
    )
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })

    await expect(filesApi.uploadDocument(file)).rejects.toMatchObject({
      message: 'File is required.',
      status: 422,
    })
  })

  it('throws a generic upload error when no body is returned', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 500, json: null, contentType: null }),
    )
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })

    await expect(filesApi.uploadDocument(file)).rejects.toThrow(
      'Upload failed. Please try again.',
    )
  })
})
