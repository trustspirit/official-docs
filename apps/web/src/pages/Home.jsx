import { Button } from 'trust-ui-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'
import { listDocuments } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <SiteLayout>
      <h1 className="page-title">공문 목록</h1>

      {loading && (
        <div className="loading-overlay">
          <span className="spinner" /> 불러오는 중…
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && docs.length === 0 && (
        <div className="empty-state">등록된 공문이 없습니다.</div>
      )}

      {!loading && docs.length > 0 && (
        <div className="doc-list">
          {docs.map((doc) => (
            <div className="doc-card" key={doc.id}>
              <div className="doc-card__left">
                <div className="doc-card__title">
                  <span className="badge">{doc.doc_type}</span>
                  {doc.title}
                </div>
                <div className="doc-card__meta">
                  <span>📅 {doc.issued_date}</span>
                  <span>수신 {doc.recipients}</span>
                  <span>발신 {doc.sender}</span>
                </div>
              </div>
              <div className="doc-card__right">
                <Button variant="outline" size="sm" onClick={() => navigate(`/doc/${doc.slug}`)}>
                  보기 →
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SiteLayout>
  )
}
