import { Button } from 'trust-ui-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase'
import { listDocuments, deleteDocument } from '../../api'
import SendMailModal from '../../components/SendMailModal'

export default function Dashboard() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mailDoc, setMailDoc] = useState(null)

  const fetchDocs = () => {
    setLoading(true)
    listDocuments(true)
      .then(setDocs)
      .catch((e) => {
        if (e.status === 401 || e.status === 403) {
          signOut(auth).finally(() => navigate('/admin/login'))
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
    await signOut(auth)
    navigate('/admin/login')
  }

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="site-header__title">지역칠십인 공문 관리자</span>
        <nav className="site-header__nav" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/contacts")}>주소록</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>공개 목록</Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>로그아웃</Button>
        </nav>
      </header>

      <main className="main-content">
        <div className="admin-header">
          <h1 className="page-title" style={{ marginBottom: 0 }}>공문 목록</h1>
          <Button variant="primary" onClick={() => navigate("/admin/create")}>+ 새 공문 작성</Button>
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
                    <td className="admin-table__title">
                      <Link to={`/doc/${doc.slug}`} style={{ color: '#1a3a5c', fontWeight: 600 }}>
                        {doc.title}
                      </Link>
                    </td>
                    <td data-label="유형"><span className="badge">{doc.doc_type}</span></td>
                    <td data-label="발행일" style={{ whiteSpace: 'nowrap' }}>{doc.issued_date}</td>
                    <td data-label="수신">{doc.recipients}</td>
                    <td data-label="공개">
                      <span style={{ color: doc.is_published ? '#1a5c2a' : '#888', fontSize: '0.8rem', fontWeight: 600 }}>
                        {doc.is_published ? '공개' : '비공개'}
                      </span>
                    </td>
                    <td className="admin-table__actions">
                      <div className="table-actions">
                        <Button variant="outline" size="sm" onClick={() => setMailDoc(doc)}>이메일 발송</Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/edit/${doc.id}`)}>편집</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(doc.id, doc.title)}>삭제</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {mailDoc && <SendMailModal doc={mailDoc} onClose={() => setMailDoc(null)} />}

      <footer className="site-footer">© 지역칠십인</footer>
    </div>
  )
}
