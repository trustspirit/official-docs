import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateContent, createDocument } from '../../api'
import { Button, TextField, Select, Switch } from 'trust-ui-react'
import ImageAttach from '../../components/ImageAttach'
import GenerationOptions from '../../components/GenerationOptions'
import LogoStyleSelect from '../../components/LogoStyleSelect'
import PreviewModal from '../../components/PreviewModal'
import { loadDraft, saveDraft, clearDraft, fmtTime } from '../../hooks/draft'

const DRAFT_KEY = 'draft:create'

function toSlug() {
  return `doc-${Date.now()}`
}

export default function Create() {
  const navigate = useNavigate()
  const editorRef = useRef(null)
  const [restored] = useState(() => loadDraft(DRAFT_KEY))
  const [savedAt, setSavedAt] = useState(restored?.savedAt || null)

  // AI가 유추 불가능한 필드만 폼에 노출
  const [form, setForm] = useState({
    issued_date: new Date().toISOString().slice(0, 10),
    recipients: '',
    cc: '',
    sender: '',
    key_points: '',
    doc_type_pref: 'auto',
    closing: 'auto',
    logo_style: 'name',
    ...restored?.form, // 이전 임시저장에 없는 항목은 기본값 유지
  })

  // AI가 생성한 필드 (생성 후 편집 가능)
  const [generated, setGenerated] = useState(restored?.generated || {
    title: '',
    doc_type: '',
  })

  const [images, setImages] = useState(restored?.images || [])
  const [slug, setSlug] = useState(restored?.slug || toSlug())
  const [isPublished, setIsPublished] = useState(restored?.isPublished ?? true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [hasGenerated, setHasGenerated] = useState(!!restored?.hasGenerated)
  // 편집 영역은 생성 후에야 마운트되므로, 생성된 본문은 state로 보관했다가 마운트 뒤에 주입
  const [preview, setPreview] = useState(null)
  const [generatedBody, setGeneratedBody] = useState(restored?.body ? { html: restored.body } : null)

  useEffect(() => {
    if (generatedBody && editorRef.current) editorRef.current.innerHTML = generatedBody.html
  }, [generatedBody])

  // ── 임시저장: 변경 후 0.6초 뒤 자동 저장 ──
  const latest = useRef(null)
  latest.current = { form, generated, images, slug, isPublished, hasGenerated }
  const timer = useRef(null)

  const scheduleSave = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const d = latest.current
      const body = editorRef.current ? editorRef.current.innerHTML : ''
      const empty = !d.form.recipients && !d.form.cc && !d.form.sender && !d.form.key_points && !body && !d.images.length
      if (empty) { clearDraft(DRAFT_KEY); setSavedAt(null); return }
      if (saveDraft(DRAFT_KEY, { ...d, body })) setSavedAt(Date.now())
    }, 600)
  }, [])

  useEffect(() => { scheduleSave() }, [form, generated, images, slug, isPublished, hasGenerated, generatedBody, scheduleSave])
  useEffect(() => () => clearTimeout(timer.current), [])

  const openPreview = () => {
    setPreview({
      title: generated.title,
      doc_type: generated.doc_type,
      logo_style: form.logo_style,
      issued_date: form.issued_date,
      recipients: form.recipients,
      cc: form.cc,
      sender: form.sender,
      content: editorRef.current ? editorRef.current.innerHTML : '',
    })
  }

  const discardDraft = () => {
    if (!window.confirm('작성 중인 내용이 모두 삭제됩니다. 취소하시겠습니까?')) return
    clearTimeout(timer.current)
    clearDraft(DRAFT_KEY)
    navigate('/admin')
  }

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
        doc_type_pref: form.doc_type_pref,
        closing: form.closing,
        images: images.map((im) => ({ path: im.path, mode: im.mode || 'inline' })),
      })
      // res = { title, doc_type, content }
      setGenerated({ title: res.title, doc_type: res.doc_type })
      setGeneratedBody({ html: res.content })
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
        logo_style: form.logo_style,
        issued_date: form.issued_date,
        recipients: form.recipients,
        cc: form.cc,
        sender: form.sender,
        content: bodyContent,
        raw_input: form.key_points,
        is_published: isPublished,
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

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="site-header__title">새 공문 작성</span>
        <nav className="site-header__nav">
          {savedAt && <span className="draft-status">임시저장됨 {fmtTime(savedAt)}</span>}
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>← 대시보드</Button>
        </nav>
      </header>

      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}
        {restored && (
          <div className="alert alert-success">
            임시저장된 작성 내용을 불러왔습니다{restored.savedAt ? ` (${fmtTime(restored.savedAt)} 저장)` : ''}.
          </div>
        )}

        <div className="admin-wrapper">
          {/* ── AI가 유추 불가한 필수 정보 ── */}
          <p style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1.2rem' }}>
            아래 정보를 입력하면 AI가 제목·유형·본문을 자동으로 작성합니다.
          </p>

          <div className="form-row">
            <div className="form-group">
              <TextField label="발행일 *" fullWidth type="date" value={form.issued_date} onChange={set('issued_date')} />
            </div>
            <div className="form-group">
              <LogoStyleSelect value={form.logo_style} onChange={(v) => setForm((f) => ({ ...f, logo_style: v }))} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <TextField label="To (수신) *" fullWidth value={form.recipients} onChange={set('recipients')} placeholder="예: 와드 회원 전체" />
            </div>
            <div className="form-group">
              <TextField label="Copies (참조) (선택)" fullWidth value={form.cc} onChange={set('cc')} placeholder="(선택)" />
            </div>
          </div>

          <div className="form-group">
            <TextField label="From / 서명 (발신) *" fullWidth multiline rows={3} value={form.sender} onChange={set('sender')} placeholder={"Notice: 발신 부서 (예: 신권 가족부)\nLetter: 서명 — 줄마다 한 명 (예: 와드 감독 홍길동). 직위와 이름은 서명에서 자동으로 다른 줄로 나뉩니다."} />
          </div>

          <div className="form-group">
            <TextField label="핵심 내용 *" fullWidth multiline value={form.key_points}
              onChange={set('key_points')}
              placeholder="AI가 공문으로 정리할 핵심 내용을 자유롭게 입력하세요.&#10;예) 6월 15일 오전 10시 와드 체육관에서 가족 홈 이브닝 행사 개최. 전 가족 참석 권장. 음식 나눔 있음."
              rows={5} />
          </div>

          <GenerationOptions
            docTypePref={form.doc_type_pref}
            closing={form.closing}
            onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          />

          <ImageAttach images={images} onChange={setImages} />

          <Button variant="primary" onClick={handleGenerate} loading={generating} disabled={generating}>
            {generating ? 'AI 생성 중…' : '✦ AI로 공문 생성'}
          </Button>

          {/* ── AI 생성 결과 (생성 후 표시) ── */}
          {hasGenerated && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #ebe8e3', margin: '1.5rem 0' }} />
              <p style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1rem' }}>
                AI가 작성한 내용입니다. 직접 수정할 수 있습니다.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <TextField label="제목" fullWidth value={generated.title} onChange={(e) => setGenerated((g) => ({ ...g, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <Select
                    label="문서 유형 (생성 결과 · 수정 가능)"
                    fullWidth
                    value={generated.doc_type}
                    onChange={(v) => setGenerated((g) => ({ ...g, doc_type: v }))}
                    options={['Letter', 'Notice'].map((t) => ({ value: t, label: t }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">공문 본문</label>
                <div
                  ref={editorRef}
                  className="body-editor"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={scheduleSave}
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #ebe8e3', margin: '1.2rem 0' }} />

              <div className="form-row">
                <div className="form-group">
                  <TextField label="슬러그 (URL)" fullWidth value={slug} onChange={(e) => setSlug(e.target.value)} />
                  <p className="form-hint">공문 URL: /doc/{slug}</p>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', paddingTop: '1.6rem' }}>
                  <Switch checked={isPublished} onChange={setIsPublished} label={isPublished ? '공개' : '비공개'} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="outline" onClick={openPreview}>미리보기</Button>
                <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
                  {saving ? '저장 중…' : '저장하기'}
                </Button>
                <Button variant="outline" onClick={discardDraft}>취소</Button>
              </div>
            </>
          )}
        </div>
      </main>
      <footer className="site-footer">© 예수 그리스도 후기 성도 교회</footer>
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
