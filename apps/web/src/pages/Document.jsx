import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDocumentBySlug } from '../api'

// 2026-03-18 → 2026년 3월 18일
const formatDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '')
  return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : d
}

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
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
          🖨 인쇄 / PDF 저장
        </button>
      </div>

      <div className="doc-paper">
        {/* 공문 헤더 */}
        <div className="doc-header">
          <div className="doc-logo">
            <img src="/img/logo.webp" alt="교회 로고" />
          </div>

          <div className="doc-title-block">
            <h1 className="doc-title">{doc.title}</h1>
            <div className="doc-type-row">
              <span className="doc-type-label">{doc.doc_type}</span>
              <span className="doc-type-sep">|</span>
              <span>{formatDate(doc.issued_date)}</span>
            </div>
            <dl className="doc-meta-list">
              <div className="meta-row">
                <dt>To:</dt>
                <dd>{doc.recipients}</dd>
              </div>
              {doc.cc && (
                <div className="meta-row">
                  <dt>Copies:</dt>
                  <dd>{doc.cc}</dd>
                </div>
              )}
              {/* Letter는 본문 끝 서명으로 발신자를 표시, Notice는 From 표시 */}
              {doc.doc_type !== 'Letter' && (
                <div className="meta-row">
                  <dt>From:</dt>
                  <dd>{doc.sender}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <hr className="doc-divider" />

        {/* AI 생성 본문 */}
        <div
          className="doc-body"
          dangerouslySetInnerHTML={{ __html: doc.content }}
        />

        <hr className="doc-footer-divider" />
      </div>
    </div>
  )
}
