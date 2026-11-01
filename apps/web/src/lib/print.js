export const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// A4 인쇄 영역 (styles/global.css 의 인쇄 규칙과 일치해야 함): @page 여백 0,
// 좌우는 .doc-paper 패딩 18mm, 상·하는 쪽마다 16mm 여백 행
const MM = 96 / 25.4
const PAGE_W = 210 * MM
const PAGE_H = (297 - 2 * 16) * MM
const PAPER_PAD = '0 18mm'
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

// 분량에 맞춰 줄간격·문단 간격·글자 크기(최대 8%)를 필요한 만큼만 줄인다.
// - 한 장을 살짝 넘으면 한 장에 맞춘다.
// - 여러 장일 때 마지막 장이 20% 이하만 차면 한 장 적은 분량에 맞춘다(끝인사·서명만 따로 남는 경우 등).
// - 그래도 안 되거나 마지막 장이 충분히 차 있으면 원래 간격 그대로 쪽을 나눈다.
const LAST_PAGE_MAX_FILL = 0.2 // 마지막 장이 이 비율 이하(한두 줄~몇 줄)만 차면 줄여서 합침
const SINGLE_PAGE_MAX = 1.2 // 한 장 기준 120% 이하로 넘칠 때만 한 장으로 압축
const MULTI_PAGE_SAFETY = 0.95 // 쪽 경계에서 생기는 빈 공간 여유

export function fitSqueeze(paper) {
  if (!paper) return 0
  const page = PAGE_H * SAFETY
  const pages = measure(paper, 0) / page
  if (pages <= 1) return 0
  const target = Math.floor(pages)
  const fill = pages - target
  const squeezable = target === 1 ? pages <= SINGLE_PAGE_MAX : fill > 0 && fill <= LAST_PAGE_MAX_FILL
  if (!squeezable) return 0
  const cap = target === 1 ? page : page * target * MULTI_PAGE_SAFETY
  const level = LEVELS.find((s) => s > 0 && measure(paper, s) <= cap)
  return level ?? 0
}

// 모바일: 인쇄 창 대신 PDF 파일을 직접 만들어 새 탭에서 연다 (브라우저 PDF 뷰어에서 저장·공유 가능).
// 비동기 작업 뒤에는 팝업이 차단되므로, 탭을 클릭 시점에 먼저 열어 두고 PDF가 준비되면 주소를 바꾼다.
async function savePdfOnMobile(paper) {
  const tab = window.open('', '_blank')
  if (tab) {
    tab.document.write('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDF</title><body style="font:16px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#444">PDF 만드는 중…</body>')
    tab.document.close()
  }
  try {
    const { buildPdfBlob } = await import('./mobilePdf.js')
    const url = URL.createObjectURL(await buildPdfBlob(paper))
    if (tab && !tab.closed) tab.location.href = url
    else window.location.href = url // 새 탭이 차단되면 현재 탭에서 연다 (뒤로 가기로 복귀)
  } catch (e) {
    console.error(e)
    tab?.close()
    window.alert('PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

// 브라우저 인쇄 창에서 "PDF로 저장"을 고르면 문서 제목이 파일명이 되도록 title을 잠시 바꿈
export function printAsPdf(title) {
  const original = document.title
  const paper = document.querySelector('.preview-overlay .doc-paper') || document.querySelector('.doc-paper')
  if (paper && isMobileDevice()) return savePdfOnMobile(paper)
  let squeeze = 0
  try { squeeze = fitSqueeze(paper) } catch { /* 압축 계산 실패해도 인쇄는 진행 */ }
  if (paper && squeeze) paper.style.setProperty('--doc-squeeze', String(squeeze))
  const restore = () => {
    document.title = original
    paper?.style.removeProperty('--doc-squeeze')
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  document.title = (title || '공문').replace(/[\\/:*?"<>|]/g, ' ').trim()

  // 카카오톡 등 인앱 브라우저·일부 모바일 브라우저는 print()가 조용히 무시된다.
  // beforeprint가 발생하지 않으면 지원되지 않는 것으로 보고 안내한다.
  let started = false
  const onBefore = () => { started = true }
  window.addEventListener('beforeprint', onBefore, { once: true })
  try {
    window.print()
  } catch {
    started = false
  }
  setTimeout(() => {
    window.removeEventListener('beforeprint', onBefore)
    if (started) return
    restore()
    window.alert(
      '이 브라우저에서는 PDF 저장(인쇄)을 지원하지 않습니다.\n' +
      '카카오톡 등 앱 안에서 열었다면 Safari 또는 Chrome으로 이 페이지를 연 뒤,\n' +
      '공유 → 인쇄(또는 메뉴 → 인쇄)에서 PDF로 저장해 주세요.',
    )
  }, 1000)
}
