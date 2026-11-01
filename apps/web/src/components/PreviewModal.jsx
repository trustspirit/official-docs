import { Button } from 'trust-ui-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import DocumentPaper from './DocumentPaper'
import { printAsPdf } from '../lib/print'

// 저장 전 미리보기 — 실제 공문과 동일한 용지로 보여 주고, 여기서 바로 PDF 저장/인쇄 가능
export default function PreviewModal({ doc, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // 인쇄 시 앱 본문은 숨기고 미리보기 용지만 출력하도록 body에 표시
  useEffect(() => {
    document.body.classList.add('previewing')
    return () => document.body.classList.remove('previewing')
  }, [])

  return createPortal(
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="공문 미리보기">
      <div className="preview-bar no-print">
        <span className="preview-bar__title">미리보기</span>
        <div className="preview-bar__actions">
          <Button variant="primary" size="sm" onClick={() => printAsPdf(doc.title)}>PDF 저장 / 인쇄</Button>
          <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
        </div>
      </div>
      <div className="preview-scroll">
        <div className="doc-page-wrapper">
          <DocumentPaper doc={doc} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
