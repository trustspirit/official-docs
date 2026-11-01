import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { generateContent, getDocument, updateDocument } from '../../api'
import ImageAttach from '../../components/ImageAttach'
import GenerationOptions from '../../components/GenerationOptions'
import PreviewModal from '../../components/PreviewModal'
import { loadDraft, saveDraft, clearDraft, fmtTime } from '../../hooks/draft'

const DOC_TYPES = ['Letter', 'Notice']

export default function Edit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editorRef = useRef(null)
  const DRAFT_KEY = `draft:edit:${id}`

  const [form, setForm] = useState(null)
  const [images, setImagesState] = useState([])
  const [preview, setPreview] = useState(null)
  const [restoredAt, setRestoredAt] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const dirty = useRef(false) // 사용자가 수정한 뒤에만 임시저장
  const timer = useRef(null)
  const latest = useRef(null)
  latest.current = { form, images }
  const setImages = (v) => { dirty.current = true; setImagesState(v) }

  const scheduleSave = useCallback(() => {
    if (!dirty.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const body = editorRef.current ? editorRef.current.innerHTML : ''
      if (saveDraft(DRAFT_KEY, { ...latest.current, body })) setSavedAt(Date.now())
    }, 600)
  }, [DRAFT_KEY])

  useEffect(() => { scheduleSave() }, [form, images, scheduleSave])
  useEffect(() => () => clearTimeout(timer.current), [])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocument(id)
      .then((doc) => {
        const draft = loadDraft(DRAFT_KEY)
        if (draft?.form) {
          dirty.current = true
          setImagesState(draft.images || [])
          setRestoredAt(draft.savedAt)
          setSavedAt(draft.savedAt)
          setForm({ doc_type_pref: 'auto', closing: 'auto', ...draft.form, content: draft.body ?? draft.form.content })
          return
        }
        setForm({
          issued_date: doc.issued_date,
          recipients: doc.recipients,
          cc: doc.cc || '',
          sender: doc.sender,
          key_points: doc.raw_input || '',
          doc_type_pref: ['Letter', 'Notice'].includes(doc.doc_type) ? doc.doc_type : 'auto',
          closing: 'auto',
          // AI가 생성한 필드 (수정 가능)
          title: doc.title,
          doc_type: doc.doc_type,
          slug: doc.slug,
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

  const set = (k) => (e) => { dirty.current = true; setForm((f) => ({ ...f, [k]: e.target.value })) }

  const handleRegenerate = async () => {
    setError('')
    setGenerating(true)
    try {
      const res = await generateContent({
        issued_date: form.issued_date,
        recipients: form.recipients,
        cc: form.cc,
        sender: form.sender,
        key_points: form.key_points,
        doc_type_pref: form.doc_type_pref,
        closing: form.closing,
        images: images.map((im) => ({ path: im.path, mode: im.mode || 'inline' })),
      })
      dirty.current = true
      setForm((f) => ({ ...f, title: res.title, doc_type: res.doc_type }))
      if (editorRef.current) editorRef.current.innerHTML = res.content
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const openPreview = () => {
    setPreview({
      title: form.title,
      doc_type: form.doc_type,
      issued_date: form.issued_date,
      recipients: form.recipients,
      cc: form.cc,
      sender: form.sender,
      content: editorRef.current ? editorRef.current.innerHTML : form.content,
    })
  }

  const discardDraft = () => {
    if (!window.confirm('저장하지 않은 수정 내용이 모두 삭제됩니다. 취소하시겠습니까?')) return
    clearTimeout(timer.current)
    clearDraft(DRAFT_KEY)
    navigate('/admin')
  }

  const revertToOriginal = () => {
    if (!window.confirm('임시저장된 수정 내용을 지우고 저장된 원본을 다시 불러옵니다.')) return
    clearTimeout(timer.current)
    clearDraft(DRAFT_KEY)
    window.location.reload()
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
      clearTimeout(timer.current)
      clearDraft(DRAFT_KEY)
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
          {savedAt && <span className="draft-status">임시저장됨 {fmtTime(savedAt)}</span>}
          <Link to="/admin" className="btn btn-secondary btn-sm">← 대시보드</Link>
        </nav>
      </header>

      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}
        {restoredAt && (
          <div className="alert alert-success">
            저장하지 않은 수정 내용을 불러왔습니다 ({fmtTime(restoredAt)} 임시저장).{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={revertToOriginal}>저장된 원본으로 되돌리기</button>
          </div>
        )}

        <div className="admin-wrapper">
          <p style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1.2rem' }}>
            정보를 수정한 뒤 AI로 재생성하거나, 아래 본문을 직접 편집할 수 있습니다.
          </p>

          {/* AI가 유추 불가한 필드 */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">발행일 *</label>
              <input className="form-input" type="date" value={form.issued_date} onChange={set('issued_date')} />
            </div>
            <div className="form-group" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">To (수신) *</label>
              <input className="form-input" value={form.recipients} onChange={set('recipients')} />
            </div>
            <div className="form-group">
              <label className="form-label">Copies (참조) <span style={{ fontWeight: 400, color: '#999' }}>(선택)</span></label>
              <input className="form-input" value={form.cc} onChange={set('cc')} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">From / 서명 (발신) *</label>
            <textarea className="form-textarea" rows={3} value={form.sender} onChange={set('sender')} />
          </div>

          <div className="form-group">
            <label className="form-label">핵심 내용</label>
            <textarea className="form-textarea" value={form.key_points} onChange={set('key_points')} rows={4} />
          </div>

          <GenerationOptions
            docTypePref={form.doc_type_pref}
            closing={form.closing}
            onChange={(k, v) => { dirty.current = true; setForm((f) => ({ ...f, [k]: v })) }}
          />

          <ImageAttach images={images} onChange={setImages} />

          <button className="btn btn-secondary" onClick={handleRegenerate} disabled={generating} style={{ marginBottom: '1.5rem' }}>
            {generating ? <><span className="spinner" /> 생성 중…</> : '↺ AI로 공문 재생성'}
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid #ebe8e3', margin: '0 0 1.5rem' }} />

          {/* AI가 생성한 필드 (편집 가능) */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">제목</label>
              <input className="form-input" value={form.title} onChange={set('title')} />
            </div>
            <div className="form-group">
              <label className="form-label">문서 유형 <span style={{ fontWeight: 400, color: '#999' }}>(생성 결과 · 수정 가능)</span></label>
              <select className="form-select" value={form.doc_type} onChange={set('doc_type')}>
                {/* 기존 문서의 옛 유형(알림 등)도 유지되도록 현재 값 포함 */}
                {[...new Set([...DOC_TYPES, form.doc_type].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
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
              onInput={() => { dirty.current = true; scheduleSave() }}
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

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={openPreview}>미리보기</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" /> 저장 중…</> : '저장하기'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={discardDraft}>취소</button>
          </div>
        </div>
      </main>
      <footer className="site-footer">© 예수 그리스도 후기 성도 교회</footer>
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
