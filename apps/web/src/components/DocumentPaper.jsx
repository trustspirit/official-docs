import { useMemo } from 'react'

// 2026-03-18 → 2026년 3월 18일
export const formatDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '')
  return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : d
}

function wrapAttachments(children) {
  const section = document.createElement('section')
  section.className = 'attachments'
  children.forEach((c) => section.appendChild(c.cloneNode(true)))
  return section
}

// 본문 HTML을 최상위 블록 단위로 나눠 "쪽 나눔 단위(행)"로 묶는다.
// - 제목(h2/h3)은 바로 다음 블록과 함께
// - 끝인사·서명(.signature)은 직전 문단과 함께 (서명만 다음 쪽에 혼자 남지 않도록)
function toRows(html) {
  if (!html) return []
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const hasLooseText = Array.from(parsed.body.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
  if (hasLooseText) return [{ html, keep: false }]
  const nodes = Array.from(parsed.body.children)
  const groups = []
  let pendingHeading = null
  for (const node of nodes) {
    const tag = node.tagName
    const isHeading = tag === 'H2' || tag === 'H3'
    if (pendingHeading) {
      pendingHeading.push(node)
      groups.push({ nodes: pendingHeading, keep: false })
      pendingHeading = null
    } else if (isHeading) {
      pendingHeading = [node]
    } else if (tag === 'SECTION' && node.classList.contains('attachments')) {
      // 첨부 영역: 제목("첨부")은 첫 이미지와 같은 행으로 묶고(제목만 홀로 한 쪽을 차지하지 않도록),
      // 이미지마다 한 행씩 나눈다. 첨부는 항상 새 쪽에서 시작.
      const kids = Array.from(node.children)
      const headings = kids.filter((k) => /^H[23]$/.test(k.tagName))
      const rest = kids.filter((k) => !/^H[23]$/.test(k.tagName))
      rest.forEach((k, idx) => {
        const first = idx === 0
        groups.push({
          nodes: first ? [wrapAttachments([...headings, k])] : [k],
          keep: true,
          pageBreak: first,
        })
      })
      if (!rest.length) groups.push({ nodes: [node], keep: false, pageBreak: true })
    } else if (node.classList.contains('signature') && groups.length) {
      const closing = groups.pop()
      const prev = groups[groups.length - 1]
      const moved = prev && prev.nodes.length > 1 ? [prev.nodes.pop()] : []
      groups.push({ nodes: [...moved, ...closing.nodes, node], keep: true })
    } else {
      groups.push({ nodes: [node], keep: tag === 'FIGURE' })
    }
  }
  if (pendingHeading) groups.push({ nodes: pendingHeading, keep: false })
  return groups.map((g) => ({ html: g.nodes.map((n) => n.outerHTML).join(''), keep: g.keep, pageBreak: !!g.pageBreak }))
}

// 공문 용지 — 문서 페이지와 미리보기에서 함께 사용
// 표 구조(doc-sheet): 인쇄 시 쪽마다 위·아래 여백 행이 반복되어 브라우저의 @page 여백 설정과 무관하게 여백이 일정하다.
export default function DocumentPaper({ doc }) {
  const rows = useMemo(() => toRows(doc.content), [doc.content])
  return (
  <div className="doc-paper">
   <table className="doc-sheet">
    <thead className="doc-sheet__head"><tr className="doc-sheet__row"><td className="doc-sheet__cell" /></tr></thead>
    <tbody className="doc-sheet__body">
      <tr className="doc-sheet__row"><td className="doc-sheet__cell">
    {/* 공문 헤더 */}
    <div className={`doc-header${doc.logo_style === 'name' ? ' doc-header--name' : ''}`}>
      {doc.logo_style === 'name' ? (
        // 로고(그림) 없이 공식 로고의 글자 부분만 이미지로 표시 (로고 사용 제한이 있는 경우)
        <div className="doc-logo doc-logo--name">
          <img src="/img/logo-name.webp" alt="예수 그리스도 후기 성도 교회" />
        </div>
      ) : (
        <div className="doc-logo">
          <img src="/img/logo.webp" alt="교회 로고" />
        </div>
      )}

      <div className="doc-title-block">
        <h1 className="doc-title">{doc.title}</h1>
        <div className="doc-type-row">
          <span className="doc-type-label">{doc.doc_type}</span>
          <span className="doc-type-sep">|</span>
          <span>{formatDate(doc.issued_date)}</span>
        </div>
        <dl className="doc-meta-list">
          <div className="meta-row">
            <dt>To:</dt>
            <dd>{doc.recipients}</dd>
          </div>
          {doc.cc && (
            <div className="meta-row">
              <dt>Copies:</dt>
              <dd>{doc.cc}</dd>
            </div>
          )}
          {/* 서명이 본문에 있으면(Letter 등) From 생략, 없으면 Notice처럼 From 표시 */}
          {doc.doc_type !== 'Letter' && !(doc.content || '').includes('class="signature"') && (
            <div className="meta-row">
              <dt>From:</dt>
              <dd>{doc.sender}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>

    <hr className="doc-divider" />
      </td></tr>
      {rows.map((r, i) => (
        <tr className={`doc-sheet__row${r.keep ? ' is-keep' : ''}${r.pageBreak ? ' is-page-break' : ''}`} key={i}>
          <td className="doc-sheet__cell doc-body" dangerouslySetInnerHTML={{ __html: r.html }} />
        </tr>
      ))}
    </tbody>
    <tfoot className="doc-sheet__foot"><tr className="doc-sheet__row"><td className="doc-sheet__cell" /></tr></tfoot>
   </table>
  </div>
  )
}
