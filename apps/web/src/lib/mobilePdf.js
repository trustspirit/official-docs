// 모바일용 PDF 생성 — 인쇄 창을 쓸 수 없는 환경에서 용지를 A4 PDF 파일로 만든다.
// 모바일 화면 CSS가 적용되지 않도록 A4 폭(793px)의 숨은 iframe에서 데스크톱 레이아웃으로 렌더링한 뒤,
// 행(.doc-sheet__row) 경계에서 쪽을 나눠 jsPDF로 묶는다.
const A4_W_PX = 793 // 210mm @ 96dpi
const MM = 96 / 25.4
const MARGIN_MM = 16 // 쪽마다 위·아래 여백 (인쇄 규칙과 동일)
const PAGE_H_PX = (297 - 2 * MARGIN_MM) * MM
const SCALE = 2

export const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function createFrame(paper) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    Object.assign(iframe.style, {
      position: 'fixed', left: '-10000px', top: '0', width: `${A4_W_PX}px`, height: '1000px', border: '0',
    })
    iframe.onload = async () => {
      const doc = iframe.contentDocument
      document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => doc.head.appendChild(n.cloneNode(true)))
      const clone = paper.cloneNode(true)
      doc.body.style.margin = '0'
      doc.body.style.background = '#fff'
      doc.body.appendChild(clone)
      Object.assign(clone.style, {
        width: `${A4_W_PX}px`, boxSizing: 'border-box', padding: '0 18mm', border: 'none', boxShadow: 'none',
      })
      // 스타일시트·웹폰트·이미지 로드 대기
      await Promise.race([
        Promise.all([
          ...Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(
            (l) => new Promise((r) => { if (l.sheet) r(); else { l.onload = r; l.onerror = r } }),
          ),
        ]).then(() => doc.fonts?.ready),
        new Promise((r) => setTimeout(r, 4000)),
      ])
      await Promise.all(
        Array.from(doc.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r }))),
      )
      resolve({ iframe, doc, clone })
    }
    document.body.appendChild(iframe)
  })
}

// 쪽 경계(px, 용지 상단 기준) 계산: 가능한 한 행 경계에서 나누고, 첨부 행은 새 쪽에서 시작
function computeBreaks(clone, totalH) {
  const top0 = clone.getBoundingClientRect().top
  const rows = Array.from(clone.querySelectorAll('.doc-sheet__body > .doc-sheet__row')).map((r) => ({
    top: r.getBoundingClientRect().top - top0,
    forced: r.classList.contains('is-page-break'),
  }))
  const breaks = [0]
  let y = 0
  while (y + PAGE_H_PX < totalH - 1) {
    const limit = y + PAGE_H_PX
    const forced = rows.find((r) => r.forced && r.top > y + 1 && r.top <= limit)
    let next
    if (forced) next = forced.top
    else {
      const fit = rows.filter((r) => r.top > y + 1 && r.top <= limit)
      next = fit.length ? fit[fit.length - 1].top : limit
    }
    breaks.push(next)
    y = next
  }
  breaks.push(totalH)
  return breaks
}

export async function buildPdfBlob(paper) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const { iframe, doc, clone } = await createFrame(paper)
  try {
    const canvas = await html2canvas(clone, {
      scale: SCALE, backgroundColor: '#fff', useCORS: true,
      windowWidth: A4_W_PX, width: A4_W_PX, scrollX: 0, scrollY: 0,
    })
    const totalH = clone.scrollHeight
    const breaks = computeBreaks(clone, totalH)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    const mmPerPx = 210 / A4_W_PX
    for (let i = 0; i < breaks.length - 1; i++) {
      const sy = Math.round(breaks[i] * SCALE)
      const sh = Math.min(Math.round((breaks[i + 1] - breaks[i]) * SCALE), canvas.height - sy)
      if (sh <= 0) continue
      const page = document.createElement('canvas')
      page.width = canvas.width
      page.height = sh
      const ctx = page.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, page.width, page.height)
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh)
      if (i > 0) pdf.addPage()
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, MARGIN_MM, 210, (sh / SCALE) * mmPerPx)
    }
    return pdf.output('blob')
  } finally {
    iframe.remove()
    void doc
  }
}

// 생성된 PDF를 열기/저장/공유할 수 있는 안내 창 (링크 클릭은 사용자 동작이므로 브라우저 제한에 걸리지 않음)
export function showPdfResult(blob, filename) {
  const url = URL.createObjectURL(blob)
  const file = new File([blob], filename, { type: 'application/pdf' })
  const wrap = document.createElement('div')
  wrap.className = 'pdf-result no-print'
  wrap.innerHTML = `
    <div class="pdf-result__card" role="dialog" aria-modal="true">
      <p class="pdf-result__title">PDF가 준비되었습니다</p>
      <p class="pdf-result__name"></p>
      <a class="pdf-result__btn pdf-result__btn--primary" target="_blank" rel="noopener">미리보기 (PDF 열기)</a>
      <a class="pdf-result__btn" data-save>저장</a>
      <button type="button" class="pdf-result__btn" data-share hidden>공유 / 파일에 저장</button>
      <button type="button" class="pdf-result__btn pdf-result__btn--ghost" data-close>닫기</button>
    </div>`
  wrap.querySelector('.pdf-result__name').textContent = filename
  wrap.querySelector('a[target]').href = url
  const save = wrap.querySelector('[data-save]')
  save.href = url
  save.download = filename
  const share = wrap.querySelector('[data-share]')
  if (navigator.canShare?.({ files: [file] })) {
    share.hidden = false
    share.onclick = () => navigator.share({ files: [file], title: filename }).catch(() => {})
  }
  const close = () => { wrap.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000) }
  wrap.querySelector('[data-close]').onclick = close
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close() })
  document.body.appendChild(wrap)
}
