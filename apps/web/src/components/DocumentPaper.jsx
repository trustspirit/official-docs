// 2026-03-18 → 2026년 3월 18일
export const formatDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '')
  return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : d
}

// 공문 용지 — 문서 페이지와 미리보기에서 함께 사용
export default function DocumentPaper({ doc }) {
  return (
  <div className="doc-paper">
    {/* 공문 헤더 */}
    <div className="doc-header">
      {doc.logo_style === 'name' ? (
        // 로고 이미지 없이 교회 이름만 표시 (로고 사용 제한이 있는 경우)
        <div className="doc-logo doc-logo--name" aria-label="예수 그리스도 후기 성도 교회">
          <span>예수 그리스도</span>
          <span>후기 성도 교회</span>
        </div>
      ) : (
        <div className="doc-logo">
          <img src="/img/logo.webp" alt="교회 로고" />
        </div>
      )}

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
          {/* 서명이 본문에 있으면(Letter 등) From 생략, 없으면 Notice처럼 From 표시 */}
          {doc.doc_type !== 'Letter' && !(doc.content || '').includes('class="signature"') && (
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
  )
}
