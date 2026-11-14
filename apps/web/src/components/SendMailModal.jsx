import { Button } from 'trust-ui-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { listContacts, sendDocumentMail } from '../api'
import DocumentPaper from './DocumentPaper'
import { buildPdfBlob } from '../lib/mobilePdf'

const MAX_PDF_BYTES = 7 * 1024 * 1024 // 서버 한도와 동일

// 전달 방식별 기본 안내문 (링크는 서버가 본문 아래에 "공문 보기: 주소"로 덧붙임)
const defaultMessage = (mode) =>
  `지역 칠십인 명의 발송 공문은 교회 웹 사이트에서 제공되지 않으므로 ${mode === 'pdf' ? '첨부된 PDF 문서를' : '아래 링크를'} 참고하시기 바랍니다.`

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('PDF를 읽지 못했습니다'))
    r.readAsDataURL(blob)
  })

// 공문 이메일 발송 — 직책 그룹 단위로 수신자를 고르고 BCC 로 보낸다
export default function SendMailModal({ doc, onClose }) {
  const paperRef = useRef(null)
  const [groups, setGroups] = useState([])
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState([])
  const [stakes, setStakes] = useState([])
  const [selectedStakes, setSelectedStakes] = useState([]) // 비어 있으면 전체, '' 은 미지정
  const [test, setTest] = useState(false)
  const [subject, setSubject] = useState(doc.title)
  const [message, setMessage] = useState(() => defaultMessage(doc.is_published ? 'link' : 'pdf'))
  const [messageEdited, setMessageEdited] = useState(false)
  const [mode, setMode] = useState(doc.is_published ? 'link' : 'pdf')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    listContacts()
      .then((r) => { setGroups(r.groups); setStakes(r.stakes || []); setContacts(r.contacts) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  // 스테이크 필터를 먼저 적용한 뒤 그룹별 인원 / 선택된 그룹의 중복 제거된 수신 인원을 센다 (서버와 같은 규칙)
  const inStakes = useMemo(
    () => (selectedStakes.length ? contacts.filter((c) => selectedStakes.includes(c.stake || '')) : contacts),
    [contacts, selectedStakes],
  )
  const hasUnassigned = contacts.some((c) => !c.stake)
  const countOf = (g) => new Set(inStakes.filter((c) => g.roles.includes(c.role)).map((c) => c.email)).size
  const groupTotal = useMemo(() => {
    const roles = groups.filter((g) => selected.includes(g.key)).flatMap((g) => g.roles)
    return new Set(inStakes.filter((c) => roles.includes(c.role)).map((c) => c.email)).size
  }, [groups, inStakes, selected])
  const total = test ? 1 : groupTotal

  // 전달 방식을 바꾸면, 내용을 직접 고치지 않은 경우에 한해 기본 안내문도 함께 바꾼다
  const changeMode = (m) => {
    setMode(m)
    if (!messageEdited) setMessage(defaultMessage(m))
  }

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  const toggleStake = (name) =>
    setSelectedStakes((s) => (s.includes(name) ? s.filter((k) => k !== name) : [...s, name]))

  // 모바일 브라우저는 window.confirm 을 띄우지 않고 false 를 반환하므로, 모달 안에서 직접 확인을 받는다
  const askConfirm = () => {
    setError('')
    if (!subject.trim()) return setError('메일 제목을 입력하세요')
    if (!total) return setError('수신 대상을 한 개 이상 선택하세요')
    setConfirming(true)
  }

  const handleSend = async () => {
    setError('')
    setConfirming(false)
    try {
      let pdf_base64
      if (mode === 'pdf') {
        setBusy('PDF 만드는 중…')
        const blob = await buildPdfBlob(paperRef.current.querySelector('.doc-paper'))
        if (blob.size > MAX_PDF_BYTES) throw new Error('PDF가 너무 큽니다(7MB 초과). 링크 방식으로 보내세요')
        pdf_base64 = await blobToBase64(blob)
      }
      setBusy('발송 중…')
      const r = await sendDocumentMail(doc.id, { subject, message, mode, groups: selected, stakes: selectedStakes, test, pdf_base64 })
      setDone(r.test ? `테스트 메일을 ${r.to} 로 발송했습니다.` : `${r.sent}명에게 발송했습니다.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="공문 이메일 발송">
      <div className="modal-card">
        <h2 className="modal-title">이메일 발송</h2>
        <p className="form-hint" style={{ marginBottom: '1rem' }}>{doc.title}</p>

        {done ? (
          <>
            <div className="alert alert-success">{done}</div>
            <div className="modal-actions"><Button variant="primary" onClick={onClose}>닫기</Button></div>
          </>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">수신 대상 (BCC)</label>
              <label className="check-row" style={{ fontWeight: 700 }}>
                <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />
                <span>테스트: 나에게만 발송</span>
              </label>
              {!groups.length && <p className="form-hint">주소록에 등록된 연락처가 없습니다</p>}
              {groups.map((g) => (
                <label key={g.key} className="check-row" style={test ? { opacity: 0.4 } : undefined}>
                  <input type="checkbox" disabled={test} checked={selected.includes(g.key)} onChange={() => toggle(g.key)} />
                  <span>{g.label}</span>
                  <span className="check-row__count">{countOf(g)}명</span>
                </label>
              ))}
              {stakes.length > 0 && (
                <details className="stake-filter" style={test ? { opacity: 0.4 } : undefined}>
                  <summary>
                    스테이크 / 지방부: {selectedStakes.length ? `${selectedStakes.length}곳 선택` : '전체'}
                  </summary>
                  <label className="check-row">
                    <input type="checkbox" disabled={test} checked={!selectedStakes.length} onChange={() => setSelectedStakes([])} />
                    <span>전체</span>
                  </label>
                  {[...stakes, ...(hasUnassigned ? [''] : [])].map((name) => (
                    <label key={name || '__none'} className="check-row">
                      <input type="checkbox" disabled={test} checked={selectedStakes.includes(name)} onChange={() => toggleStake(name)} />
                      <span>{name || '미지정'}</span>
                      <span className="check-row__count">{new Set(contacts.filter((c) => (c.stake || '') === name).map((c) => c.email)).size}명</span>
                    </label>
                  ))}
                </details>
              )}
              <p className="form-hint">{test ? '테스트 발송: 로그인한 내 이메일로만 전달됩니다' : `선택한 직책의 모든 분께 숨은 참조(BCC)로 발송됩니다 · 총 ${total}명`}</p>
            </div>

            <div className="form-group">
              <label className="form-label">메일 제목</label>
              <input className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            </div>

            <div className="form-group">
              <label className="form-label">발송 내용</label>
              <textarea className="form-textarea" rows={5} value={message} onChange={(e) => { setMessage(e.target.value); setMessageEdited(true) }} maxLength={5000} />
            </div>

            <div className="form-group">
              <label className="form-label">전달 방식</label>
              <label className="check-row">
                <input type="radio" name="mode" checked={mode === 'link'} disabled={!doc.is_published} onChange={() => changeMode('link')} />
                <span>공문 링크 전달{!doc.is_published && ' (비공개 공문은 불가)'}</span>
              </label>
              <label className="check-row">
                <input type="radio" name="mode" checked={mode === 'pdf'} onChange={() => changeMode('pdf')} />
                <span>PDF 첨부</span>
              </label>
            </div>

            {confirming && !busy && (
              <div className="alert alert-error" role="alert">
                {test ? `"${subject}" 메일을 테스트로 나에게만 발송합니다.` : `"${subject}" 메일을 ${total}명에게 BCC로 발송합니다.`} 보낼까요?
              </div>
            )}

            <div className="modal-actions">
              <Button variant="outline" onClick={confirming && !busy ? () => setConfirming(false) : onClose} disabled={!!busy}>취소</Button>
              <Button variant="primary" onClick={confirming ? handleSend : askConfirm} disabled={!!busy || !total}>
                {busy || (confirming ? '확인, 발송' : test ? '나에게 테스트 발송' : `${total}명에게 발송`)}
              </Button>
            </div>
          </>
        )}

        {/* PDF 생성용 숨은 용지 */}
        {mode === 'pdf' && (
          <div style={{ position: 'fixed', left: '-10000px', top: 0 }} aria-hidden="true">
            <div ref={paperRef}><DocumentPaper doc={doc} /></div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
