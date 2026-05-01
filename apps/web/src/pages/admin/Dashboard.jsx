import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listDocuments, deleteDocument, logout, clearToken } from '../../api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDocs = () => {
    setLoading(true)
    listDocuments(true)
      .then(setDocs)
      .catch((e) => {
        if (e.message.includes('인증') || e.message.includes('401')) {
          clearToken(); navigate('/admin/login')
        } else setError(e.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchDocs() }, [])

  const handleDelete = async (id, title) => {
    if (!confirm(`"${title}" 공문을 삭제하시겠습니까?`)) return
    try {
      await deleteDocument(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  const handleLogout = async () => {
    await logout().catch(() => {})
    clearToken()
    navigate('/admin/login')
  }

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="site-header__title">공문 관리자</span>
        <nav className="site-header__nav" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/" className="btn btn-secondary btn-sm">공개 목록</Link>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>로그아웃</button>
        </nav>
      </header>

      <main className="main-content">
        <div className="admin-header">
          <h1 className="page-title" style={{ marginBottom: 0 }}>공문 목록</h1>
          <Link to="/admin/create" className="btn btn-primary">+ 새 공문 작성</Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /> 불러오는 중…</div>
        ) : docs.length === 0 ? (
          <div className="empty-state">등록된 공문이 없습니다.</div>
        ) : (
          <div className="admin-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>유형</th>
                  <th>발행일</th>
                  <th>수신</th>
                  <th>공개</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <Link to={`/doc/${doc.slug}`} style={{ color: '#1a3a5c', fontWeight: 600 }}>
                        {doc.title}
                      </Link>
                    </td>
                    <td><span className="badge">{doc.doc_type}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{doc.issued_date}</td>
                    <td>{doc.recipients}</td>
                    <td>
                      <span style={{ color: doc.is_published ? '#1a5c2a' : '#888', fontSize: '0.8rem', fontWeight: 600 }}>
                        {doc.is_published ? '공개' : '비공개'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/admin/edit/${doc.id}`} className="btn btn-secondary btn-sm">편집</Link>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id, doc.title)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className="site-footer">© 예수 그리스도 후기 성도 교회</footer>
    </div>
  )
}
