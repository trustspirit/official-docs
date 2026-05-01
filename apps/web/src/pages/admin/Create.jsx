import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { generateContent, createDocument } from '../../api'

function toSlug() {
  return `doc-${Date.now()}`
}

export default function Create() {
  const navigate = useNavigate()
  const editorRef = useRef(null)

  // AI가 유추 불가능한 필드만 폼에 노출
  const [form, setForm] = useState({
    issued_date: new Date().toISOString().slice(0, 10),
    recipients: '',
    cc: '',
    sender: '',
    key_points: '',
  })

  // AI가 생성한 필드 (생성 후 편집 가능)
  const [generated, setGenerated] = useState({
    title: '',
    doc_type: '',
  })

  const [slug, setSlug] = useState(toSlug())
  const [isPublished, setIsPublished] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleGenerate = async () => {
    const required = ['issued_date', 'recipients', 'sender', 'key_points']
    const missing = required.filter((k) => !form[k].trim())
    if (missing.length) {
      setError('발행일, 수신, 발신, 핵심내용은 필수 항목입니다.')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const res = await generateContent({
        issued_date: form.issued_date,
        recipients: form.recipients,
        cc: form.cc,
        sender: form.sender,
        key_points: form.key_points,
      })
      // res = { title, doc_type, content }
      setGenerated({ title: res.title, doc_type: res.doc_type })
      if (editorRef.current) editorRef.current.innerHTML = res.content
      setHasGenerated(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    const bodyContent = editorRef.current ? editorRef.current.innerHTML : ''
    if (!hasGenerated || !bodyContent.trim()) {
      setError('먼저 AI로 본문을 생성하세요.')
      return
    }
    if (!generated.title.trim()) { setError('제목을 입력하세요.'); return }
    if (!slug.trim()) { setError('슬러그를 입력하세요.'); return }
    setError('')
    setSaving(true)
    try {
      const doc = await createDocument({
        slug,
        title: generated.title,
        doc_type: generated.doc_type,
        issued_date: form.issued_date,
        recipients: form.recipients,
        cc: form.cc,
        sender: form.sender,
        content: bodyContent,
        raw_input: form.key_points,
        is_published: isPublished,
      })
      navigate(`/doc/${doc.slug}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="site-header__title">새 공문 작성</span>
        <nav className="site-header__nav">
          <Link to="/admin" className="btn btn-secondary btn-sm">← 대시보드</Link>
        </nav>
      </header>

      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-wrapper">
          {/* ── AI가 유추 불가한 필수 정보 ── */}
          <p style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1.2rem' }}>
            아래 정보를 입력하면 AI가 제목·유형·본문을 자동으로 작성합니다.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">발행일 *</label>
              <input className="form-input" type="date" value={form.issued_date} onChange={set('issued_date')} />
            </div>
            <div className="form-group">
              {/* 빈 칸 — 레이아웃 균형 */}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">수신 *</label>
              <input className="form-input" value={form.recipients} onChange={set('recipients')} placeholder="예: 와드 회원 전체" />
            </div>
            <div className="form-group">
              <label className="form-label">참조 <span style={{ fontWeight: 400, color: '#999' }}>(선택)</span></label>
              <input className="form-input" value={form.cc} onChange={set('cc')} placeholder="(선택)" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">발신 *</label>
            <input className="form-input" value={form.sender} onChange={set('sender')} placeholder="예: 와드 감독단" />
          </div>

          <div className="form-group">
            <label className="form-label">핵심 내용 *</label>
            <textarea
              className="form-textarea"
              value={form.key_points}
              onChange={set('key_points')}
              placeholder="AI가 공문으로 정리할 핵심 내용을 자유롭게 입력하세요.&#10;예) 6월 15일 오전 10시 와드 체육관에서 가족 홈 이브닝 행사 개최. 전 가족 참석 권장. 음식 나눔 있음."
              rows={5}
            />
          </div>

          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? <><span className="spinner" /> AI 생성 중…</> : '✦ AI로 공문 생성'}
          </button>

          {/* ── AI 생성 결과 (생성 후 표시) ── */}
          {hasGenerated && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #ebe8e3', margin: '1.5rem 0' }} />
              <p style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1rem' }}>
                AI가 작성한 내용입니다. 직접 수정할 수 있습니다.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">제목</label>
                  <input
                    className="form-input"
                    value={generated.title}
                    onChange={(e) => setGenerated((g) => ({ ...g, title: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">문서 유형</label>
                  <select
                    className="form-select"
                    value={generated.doc_type}
                    onChange={(e) => setGenerated((g) => ({ ...g, doc_type: e.target.value }))}
                  >
                    {['알림', '공지', '지시', '요청', '기타'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">공문 본문</label>
                <div
                  ref={editorRef}
                  className="body-editor"
                  contentEditable
                  suppressContentEditableWarning
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #ebe8e3', margin: '1.2rem 0' }} />

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">슬러그 (URL)</label>
                  <input className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
                  <p className="form-hint">공문 URL: /doc/{slug}</p>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', paddingTop: '1.6rem' }}>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                  <span className="form-label" style={{ marginBottom: 0 }}>
                    {isPublished ? '공개' : '비공개'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><span className="spinner" /> 저장 중…</> : '저장하기'}
                </button>
                <Link to="/admin" className="btn btn-secondary">취소</Link>
              </div>
            </>
          )}
        </div>
      </main>
      <footer className="site-footer">© 예수 그리스도 후기 성도 교회</footer>
    </div>
  )
}
