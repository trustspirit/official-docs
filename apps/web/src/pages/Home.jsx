import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'
import { listDocuments } from '../api'

// 본문 HTML에서 목록용 요약문(텍스트)을 만든다. 표시 시 CSS로 2줄까지만 보인다.
function toExcerpt(html) {
  const text = new DOMParser().parseFromString(html || '', 'text/html').body.textContent || ''
  return text.replace(/\s+/g, ' ').trim().slice(0, 240)
}

export default function Home() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const items = useMemo(() => docs.map((d) => ({ ...d, excerpt: toExcerpt(d.content) })), [docs])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((d) => `${d.title} ${d.doc_type} ${d.excerpt}`.toLowerCase().includes(q))
  }, [items, query])

  return (
    <SiteLayout>
      <h1 className="library-title">공문 목록</h1>

      <form className="library-search" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="공문 검색…"
          aria-label="공문 검색"
        />
        <button type="submit">검색</button>
      </form>

      {loading && (
        <div className="loading-overlay">
          <span className="spinner" /> 불러오는 중…
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && docs.length === 0 && (
        <div className="empty-state">등록된 공문이 없습니다.</div>
      )}

      {!loading && docs.length > 0 && filtered.length === 0 && (
        <div className="empty-state">검색 결과가 없습니다.</div>
      )}

      {filtered.length > 0 && (
        <ul className="library-list">
          {filtered.map((doc) => (
            <li className="library-item" key={doc.id}>
              <Link to={`/doc/${doc.slug}`} className="library-item__link">
                <h2 className="library-item__title">{doc.title}</h2>
                <p className="library-item__meta">
                  <span className="library-item__type">{doc.doc_type}</span>
                  <span className="library-item__date">{doc.issued_date}</span>
                </p>
                {doc.excerpt && <p className="library-item__excerpt">{doc.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SiteLayout>
  )
}
