// A4 인쇄 영역 (styles/global.css 의 @page 여백·.doc-paper 인쇄 패딩과 일치해야 함)
const MM = 96 / 25.4
const PAGE_W = (210 - 2 * 10) * MM // @page 좌우 여백 10mm
const PAGE_H = (297 - 2 * 12) * MM // @page 상하 여백 12mm
const PAPER_PAD = '14mm 16mm'
const LEVELS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] // 필요한 만큼만 압축
const SAFETY = 0.97 // 화면/인쇄 레이아웃 오차 여유

// 용지를 인쇄 폭으로 복제해 높이를 잰다 (첨부 페이지는 별도 페이지이므로 제외)
function measure(paper, squeeze) {
  const clone = paper.cloneNode(true)
  clone.querySelectorAll('.attachments').forEach((n) => n.remove())
  Object.assign(clone.style, {
    position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden',
    width: `${PAGE_W}px`, boxSizing: 'border-box', padding: PAPER_PAD, border: 'none',
  })
  clone.style.setProperty('--doc-squeeze', String(squeeze))
  document.body.appendChild(clone)
  const h = clone.scrollHeight
  clone.remove()
  return h
}

// 한 장에 들어갈 수 있는 분량이면 줄간격·문단 간격을 필요한 만큼만 줄인다.
// 압축해도 한 장을 넘으면 원래 간격 그대로 여러 장으로 출력한다.
export function fitToOnePage(paper) {
  if (!paper) return 0
  const limit = PAGE_H * SAFETY
  if (measure(paper, 0) <= limit) return 0
  const level = LEVELS.find((s) => s > 0 && measure(paper, s) <= limit)
  return level ?? 0
}

// 브라우저 인쇄 창에서 "PDF로 저장"을 고르면 문서 제목이 파일명이 되도록 title을 잠시 바꿈
export function printAsPdf(title) {
  const original = document.title
  const paper = document.querySelector('.preview-overlay .doc-paper') || document.querySelector('.doc-paper')
  const squeeze = fitToOnePage(paper)
  if (paper && squeeze) paper.style.setProperty('--doc-squeeze', String(squeeze))
  const restore = () => {
    document.title = original
    paper?.style.removeProperty('--doc-squeeze')
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  document.title = (title || '공문').replace(/[\\/:*?"<>|]/g, ' ').trim()
  window.print()
}
