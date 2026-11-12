// 모바일용 PDF 생성 — 인쇄 창을 쓸 수 없는 환경에서 용지를 A4 PDF 파일로 만든다.
// 모바일 화면 CSS가 적용되지 않도록 A4 폭(793px)의 숨은 iframe에서 데스크톱 레이아웃으로 렌더링한 뒤,
// 행(.doc-sheet__row) 경계에서 쪽을 나눠 jsPDF로 묶는다.
const A4_W_PX = 793 // 210mm @ 96dpi
const MM = 96 / 25.4
const MARGIN_MM = 16 // 쪽마다 위·아래 여백 (인쇄 규칙과 동일)
const PAGE_H_PX = (297 - 2 * MARGIN_MM) * MM
const MAX_SCALE = 2
const MAX_PIXELS = 14e6 // 모바일 캔버스 메모리 한도(iOS 약 16M px) 안쪽으로

function createFrame(paper) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    Object.assign(iframe.style, {
      position: 'fixed', left: '-10000px', top: '0', width: `${A4_W_PX}px`, height: '1000px', border: '0',
    })
    // 일부 모바일 브라우저는 빈 iframe의 load 이벤트가 오지 않을 수 있어 srcdoc + 타임아웃으로 반드시 진행
    let started = false
    const go = () => { if (!started) { started = true; init() } }
    iframe.onload = go
    setTimeout(go, 3000)
    iframe.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'
    const init = async () => {
      const doc = iframe.contentDocument
      // 같은 출처의 CSS는 규칙을 <style>로 직접 복사(로드 대기·경쟁 상태 없음), 읽을 수 없는 외부 CSS(웹폰트)만 <link>로 복제
      let css = ''
      const links = []
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          css += Array.from(sheet.cssRules).map((r) => r.cssText).join('\n') + '\n'
        } catch {
          if (sheet.href) links.push(sheet.href)
        }
      }
      const style = doc.createElement('style')
      // html2canvas는 자간이 0이 아니면 글자를 하나씩 따로 그려 한글 간격이 벌어지므로 캡처 시에는 자간을 끈다
      // 폰트 목록에 "Ensign:Serif" 같은 이름이 섞여 있으면 캔버스가 폰트 지정을 무시하므로 단순한 목록으로 바꾼다
      style.textContent = css + `
*{letter-spacing:normal !important}
.doc-title,.doc-body,.doc-meta-list{font-family:"Nanum Myeongjo",serif !important}
.doc-type-row,.doc-body h2,.doc-body h3,.doc-body figcaption{font-family:"Noto Sans KR",sans-serif !important}`
      doc.head.appendChild(style)
      links.forEach((href) => {
        const l = doc.createElement('link')
        l.rel = 'stylesheet'
        l.href = href
        doc.head.appendChild(l)
      })
      const clone = paper.cloneNode(true)
      doc.body.style.margin = '0'
      doc.body.style.background = '#fff'
      doc.body.appendChild(clone)
      Object.assign(clone.style, {
        width: `${A4_W_PX}px`, boxSizing: 'border-box', padding: '0 18mm', border: 'none', boxShadow: 'none',
      })
      // 웹폰트·이미지 로드 대기 (최대 5초)
      const FONTS = ['400 16px "Nanum Myeongjo"', '700 16px "Nanum Myeongjo"', '400 16px "Noto Sans KR"', '700 16px "Noto Sans KR"']
      const text = clone.textContent || ''
      await Promise.race([
        (async () => {
          await new Promise((r) => setTimeout(r, 50))
          await Promise.all(FONTS.map((f) => doc.fonts.load(f, text).catch(() => null)))
          await doc.fonts.ready
        })(),
        new Promise((r) => setTimeout(r, 5000)),
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

// 이미지로 캡처한 PDF에서도 링크(웹·이메일·전화)가 동작하도록, 본문 <a>의 화면 위치(줄마다 사각형)를 모은다
const LINK_RE = /^(https?:|mailto:|tel:)/i
function collectLinks(clone) {
  const box = clone.getBoundingClientRect()
  const out = []
  clone.querySelectorAll('a[href]').forEach((a) => {
    const url = a.getAttribute('href')
    if (!LINK_RE.test(url || '')) return
    Array.from(a.getClientRects()).forEach((r) => {
      if (r.width < 1 || r.height < 1) return
      out.push({ url, x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height })
    })
  })
  return out
}

export async function buildPdfBlob(paper) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const { iframe, doc, clone } = await createFrame(paper)
  try {
    const totalH = clone.scrollHeight
    const SCALE = Math.max(1, Math.min(MAX_SCALE, Math.sqrt(MAX_PIXELS / (A4_W_PX * totalH))))
    const canvas = await html2canvas(clone, {
      scale: SCALE, backgroundColor: '#fff', useCORS: true, imageTimeout: 8000,
      windowWidth: A4_W_PX, width: A4_W_PX, scrollX: 0, scrollY: 0,
    })
    const breaks = computeBreaks(clone, totalH)
    const links = collectLinks(clone)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    const mmPerPx = 210 / A4_W_PX
    let pageNo = 0
    for (let i = 0; i < breaks.length - 1; i++) {
      const sy = Math.round(breaks[i] * SCALE)
      const sh = Math.min(Math.round((breaks[i + 1] - breaks[i]) * SCALE), canvas.height - sy)
      if (sh <= 0) continue
      pageNo += 1
      const page = document.createElement('canvas')
      page.width = canvas.width
      page.height = sh
      const ctx = page.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, page.width, page.height)
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh)
      if (pageNo > 1) pdf.addPage()
      const data = page.toDataURL('image/jpeg', 0.92)
      pdf.addImage(data, 'JPEG', 0, MARGIN_MM, 210, (sh / SCALE) * mmPerPx)
      // 이 쪽에 그려진 링크 위치에 클릭 영역을 얹는다 (줄의 중앙이 이 쪽 범위에 있는 것만)
      links
        .filter((l) => l.y + l.h / 2 >= breaks[i] && l.y + l.h / 2 < breaks[i + 1])
        .forEach((l) => {
          pdf.link(l.x * mmPerPx, MARGIN_MM + (l.y - breaks[i]) * mmPerPx, l.w * mmPerPx, l.h * mmPerPx, { url: l.url })
        })
    }
    return pdf.output('blob')
  } finally {
    iframe.remove()
    void doc
  }
}
