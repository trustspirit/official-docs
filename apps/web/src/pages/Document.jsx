import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDocumentBySlug } from '../api'
import DocumentPaper from '../components/DocumentPaper'
import { printAsPdf } from '../lib/print'

export default function Document() {
  const { slug } = useParams()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getDocumentBySlug(slug)
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <span className="spinner" /> 불러오는 중…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <p style={{ color: '#8b0000', marginBottom: '1rem' }}>
          {error || '공문을 찾을 수 없습니다.'}
        </p>
        <Link to="/" className="btn btn-secondary">← 목록으로</Link>
      </div>
    )
  }

  return (
    <div className="doc-page-wrapper">
      {/* 화면 전용 액션 버튼 */}
      <div className="doc-actions no-print">
        <Link to="/" className="btn btn-secondary btn-sm">← 목록으로</Link>
        <button className="btn btn-primary btn-sm" onClick={() => printAsPdf(doc.title)}>
          PDF 저장 / 인쇄
        </button>
      </div>

      <DocumentPaper doc={doc} />
    </div>
  )
}
