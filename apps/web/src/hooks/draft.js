// 브라우저 localStorage 기반 임시저장 (서버·설정 불필요)
export const loadDraft = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const saveDraft = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() }))
    return true
  } catch {
    return false // 용량 초과·저장 차단 시 조용히 무시
  }
}

export const clearDraft = (key) => {
  try { localStorage.removeItem(key) } catch { /* noop */ }
}

export const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
