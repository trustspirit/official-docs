import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { generateContent, getDocument, updateDocument } from '../../api'

const DOC_TYPES = ['알림', '공지', '지시', '요청', '기타']

export default function Edit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editorRef = useRef(null)

  const [form, setForm] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocument(id)
      .then((doc) => {
        setForm({
          slug: doc.slug,
          title: doc.title,
          doc_type: doc.doc_type,
          issued_date: doc.issued_date,
          recipients: doc.recipients,
          cc: doc.cc || '',
          sender: doc.sender,
          key_points: doc.raw_input || '',
          is_published: doc.is_published,
          content: doc.content,
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (form?.content && editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = form.content
    }
  }, [form])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleGenerate = async () => {
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
      if (editorRef.current) editorRef.current.innerHTML = res.content
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    const bodyContent = editorRef.current ? editorRef.current.innerHTML : form.content
    setError('')
    setSaving(true)
    try {
      const doc = await updateDocument(id, {
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

  if (loading) return <div className="loading-overlay" style={{ minHeight: '100vh' }}><span className="spinner" /></div>
  if (!form) return <div className="alert alert-error" style={{ margin: '2rem' }}>{error}</div>

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="site-header__title">공문 편집</span>
        <nav className="site-header__nav">
          <Link to="/admin" className="btn btn-secondary btn-sm">← 대시보드</Link>
        </nav>
      </header>

      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-wrapper">
          <div className="form-group">
            <label className="form-label">제목 *</label>
            <input className="form-input" value={form.title} onChange={set('title')} />
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
              <input className="form-input" value={form.recipients} onChange={set('recipients')} />
            </div>
            <div className="form-group">
              <label className="form-label">참조</label>
              <input className="form-input" value={form.cc} onChange={set('cc')} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">발신 *</label>
            <input className="form-input" value={form.sender} onChange={set('sender')} />
          </div>

          <div className="form-group">
            <label className="form-label">핵심 내용 (AI 재생성 시 사용)</label>
            <textarea className="form-textarea" value={form.key_points} onChange={set('key_points')} rows={4} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
            <button className="btn btn-secondary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><span className="spinner" /> 생성 중…</> : '↺ AI로 본문 재생성'}
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">공문 본문 (직접 편집 가능)</label>
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
              <input className="form-input" value={form.slug} onChange={set('slug')} />
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
