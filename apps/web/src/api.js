const BASE = '/api'

export const getToken = () => localStorage.getItem('admin_token')
export const setToken = (t) => localStorage.setItem('admin_token', t)
export const clearToken = () => localStorage.removeItem('admin_token')

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
})

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
}

// Auth
export const login = (username, password) =>
  api.post('/auth/login', { username, password })
export const getMe = () => api.get('/auth/me')
export const logout = () => api.post('/auth/logout')

// Documents
export const listDocuments = (admin = false) =>
  api.get(`/documents${admin ? '?admin=1' : ''}`)
export const getDocument = (id) => api.get(`/documents/${id}`)
export const getDocumentBySlug = (slug) => api.get(`/documents/slug/${slug}`)
export const createDocument = (data) => api.post('/documents', data)
export const updateDocument = (id, data) => api.put(`/documents/${id}`, data)
export const deleteDocument = (id) => api.delete(`/documents/${id}`)

// AI
export const generateContent = (data) => api.post('/generate', data)
