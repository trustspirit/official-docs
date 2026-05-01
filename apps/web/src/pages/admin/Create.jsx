import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { generateContent, createDocument } from '../../api'

const DOC_TYPES = ['알림', '공지', '지시', '요청', '기타']

function toSlug() {
  return `doc-${Date.now()}`
}

export default function Create() {
  const navigate = useNavigate()
  const editorRef = useRef(null)

  const [form, setForm] = useState({
    slug: toSlug(),
    title: '',
    doc_type: '알림',
    issued_date: new Date().toISOString().slice(0, 10),
    recipients: '',
    cc: '',
    sender: '',
    key_points: '',
    is_published: true,
  })
  const [content, setContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleGenerate = async () => {
    const required = ['title', 'doc_type', 'issued_date', 'recipients', 'sender', 'key_points']
    const missing = required.filter((k) => !form[k].trim())
    if (missing.length) { setError('제목, 문서유형, 발행일, 수신, 발신, 핵심내용을 모두 입력하세요.'); return }
    setError('')
    setGenerating(true)
    try {
      const res = await generateContent({
        title: form.title,
        doc_type: form.doc_type,
        issued_date: form.issued_date,
        recipients: form.recipients,
        cc: form.cc,
        sender: form.sender,
        key_points: form.key_points,
      })
      setContent(res.content)
      if (editorRef.current) editorRef.current.innerHTML = res.content
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    const bodyContent = editorRef.current ? editorRef.current.innerHTML : content
    if (!bodyContent.trim()) { setError('본문을 먼저 생성하거나 직접 작성하세요.'); return }
    if (!form.slug.trim()) { setError('슬러그를 입력하세요.'); return }
    setError('')
    setSaving(true)
    try {
      const doc = await createDocument({
        slug: form.slug,
        title: form.title,
        doc_type: form.doc_type,
        issued_date: form.issued_date,
        recipients: form.recipients,
        cc: form.cc,
        sender: form.sender,
        content: bodyContent,
        raw_input: form.key_points,
        is_published: form.is_published,
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
          {/* 기본 정보 */}
          <div className="form-group">
            <label className="form-label">제목 *</label>
            <input className="form-input" value={form.title} onChange={set('title')} placeholder="공문 제목" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">문서 유형 *</label>
              <select className="form-select" value={form.doc_type} onChange={set('doc_type')}>
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">발행일 *</label>
              <input className="form-input" type="date" value={form.issued_date} onChange={set('issued_date')} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">수신 *</label>
              <input className="form-input" value={form.recipients} onChange={set('recipients')} placeholder="예: 와드 회원 전체" />
            </div>
            <div className="form-group">
              <label className="form-label">참조</label>
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
              placeholder="AI가 공문 형식으로 정리할 핵심 내용을 자유롭게 입력하세요."
              rows={5}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><span className="spinner" /> AI 생성 중…</> : '✦ AI로 본문 생성'}
            </button>
          </div>

          {/* 본문 편집기 */}
          <div className="form-group">
            <label className="form-label">공문 본문 (직접 편집 가능)</label>
            <div
              ref={editorRef}
              className="body-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="'AI로 본문 생성' 버튼을 클릭하거나 직접 입력하세요."
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #ebe8e3', margin: '1.2rem 0' }} />

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">슬러그 (URL)</label>
              <input className="form-input" value={form.slug} onChange={set('slug')} placeholder="doc-..." />
              <p className="form-hint">공문 URL: /doc/{form.slug}</p>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', paddingTop: '1.6rem' }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                />
                <span className="toggle-slider" />
              </label>
              <span className="form-label" style={{ marginBottom: 0 }}>
                {form.is_published ? '공개' : '비공개'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" /> 저장 중…</> : '저장하기'}
            </button>
            <Link to="/admin" className="btn btn-secondary">취소</Link>
          </div>
        </div>
      </main>
      <footer className="site-footer">© 예수 그리스도 후기 성도 교회</footer>
    </div>
  )
}
