import { Button } from 'trust-ui-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listContacts, addContact, deleteContact, importContactsCsv } from '../../api'

const EMPTY = { role: '', unit: '', name: '', phone: '', email: '' }

// 주소록 관리 — 직책별 연락처 확인, CSV 갱신, 개별 추가/삭제
export default function Contacts() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [groups, setGroups] = useState([])
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const roles = groups.flatMap((g) => g.roles)

  const load = () =>
    listContacts()
      .then((r) => { setGroups(r.groups); setContacts(r.contacts) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const handleCsv = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('CSV로 주소록을 갱신합니다. 이전에 CSV로 올린 연락처는 교체되고, 직접 추가한 연락처는 유지됩니다.\n계속할까요?')) return
    setError(''); setNotice('')
    try {
      const r = await importContactsCsv(await file.text())
      setNotice(`${r.imported}명을 가져왔습니다.${r.skipped.length ? ` 건너뜀 ${r.skipped.length}건: ${r.skipped.join(' / ')}` : ''}`)
      load()
    } catch (err) { setError(err.message) }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError(''); setNotice('')
    try {
      await addContact(form)
      setForm(EMPTY)
      load()
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (c) => {
    if (!confirm(`${c.name || c.email} (${c.role}) 님을 삭제할까요?`)) return
    try {
      await deleteContact(c.id)
      setContacts((prev) => prev.filter((x) => x.id !== c.id))
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="site-header__title">주소록</span>
        <nav className="site-header__nav">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>← 공문 목록</Button>
        </nav>
      </header>

      <main className="main-content">
        <div className="admin-header">
          <h1 className="page-title" style={{ marginBottom: 0 }}>주소록 ({contacts.length}명)</h1>
          <div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleCsv} />
            <Button variant="primary" onClick={() => fileRef.current?.click()}>CSV로 갱신</Button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        <form className="admin-wrapper contact-form" onSubmit={handleAdd}>
          <select className="form-select" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="">직책 선택</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="form-input" placeholder="단위(와드/스테이크)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input className="form-input" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="form-input" type="email" required placeholder="이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Button variant="outline" type="submit">추가</Button>
        </form>

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /> 불러오는 중…</div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">주소록이 비어 있습니다. CSV로 갱신해 주세요.</div>
        ) : (
          groups.map((g) => (
            <section key={g.key} style={{ marginBottom: '1.5rem' }}>
              <h2 className="page-title" style={{ fontSize: '1.05rem' }}>{g.label}</h2>
              <div className="admin-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="admin-table">
                  <thead><tr><th>직책</th><th>단위</th><th>이름</th><th>이메일</th><th>관리</th></tr></thead>
                  <tbody>
                    {contacts.filter((c) => g.roles.includes(c.role)).map((c) => (
                      <tr key={c.id}>
                        <td data-label="직책">{c.role}</td>
                        <td data-label="단위">{c.unit}</td>
                        <td data-label="이름">{c.name}</td>
                        <td data-label="이메일">{c.email}</td>
                        <td className="admin-table__actions">
                          <Button variant="danger" size="sm" onClick={() => handleDelete(c)}>삭제</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
