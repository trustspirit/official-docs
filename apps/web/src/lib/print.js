// 브라우저 인쇄 창에서 "PDF로 저장"을 고르면 문서 제목이 파일명이 되도록 title을 잠시 바꿈
export function printAsPdf(title) {
  const original = document.title
  const restore = () => {
    document.title = original
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  document.title = (title || '공문').replace(/[\\/:*?"<>|]/g, ' ').trim()
  window.print()
}
