import { Button } from 'trust-ui-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
      </div>
    )
  }

  return (
    <div className="doc-page-wrapper">
      <DocumentPaper doc={doc} />

      {/* 화면 전용 액션 버튼 */}
      <div className="doc-actions no-print">
        <Button variant="primary" size="sm" onClick={() => printAsPdf(doc.title)}>
          PDF 저장 / 인쇄
        </Button>
      </div>
    </div>
  )
}
