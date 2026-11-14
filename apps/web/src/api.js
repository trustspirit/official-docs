import { auth } from './firebase'

const BASE = '/api'

// Firebase ID 토큰(1시간 유효, SDK가 자동 갱신)을 매 요청에 붙인다
async function idToken() {
  await auth.authStateReady()
  return auth.currentUser ? auth.currentUser.getIdToken() : null
}

async function request(method, path, body) {
  const token = await idToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.detail || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
}

// Auth (Google 로그인은 Firebase Auth, 관리자 여부는 서버가 허용 이메일로 판단)
export const getMe = () => api.get('/auth/me')

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

// Image upload (multipart — Content-Type은 브라우저가 boundary와 함께 설정)
export async function uploadImage(file) {
  const body = new FormData()
  body.append('file', file)
  const token = await idToken()
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data // { path, url, media_type }
}

// Contacts (주소록) & mail
export const listContacts = () => api.get('/contacts')
export const addContact = (data) => api.post('/contacts', data)
export const deleteContact = (id) => api.delete(`/contacts/${id}`)
export const updateContactStake = (id, stake) => api.put(`/contacts/${id}`, { stake })
export const importContactsCsv = (csv) => api.post('/contacts/import', { csv })
export const sendDocumentMail = (id, data) => api.post(`/documents/${id}/send`, data)
