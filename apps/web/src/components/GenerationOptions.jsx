// 생성 전에 문서 유형과 끝인사를 직접 선택 (AI 자동 판단에 맡기지 않을 수 있도록)
export default function GenerationOptions({ docTypePref, closing, onChange }) {
  return (
    <div className="form-row">
      <div className="form-group">
        <label className="form-label">문서 유형 <span style={{ fontWeight: 400, color: '#999' }}>(생성 전에 선택)</span></label>
        <select className="form-select" value={docTypePref} onChange={(e) => onChange('doc_type_pref', e.target.value)}>
          <option value="auto">AI가 판단</option>
          <option value="Letter">Letter (서한 — 인사말 포함)</option>
          <option value="Notice">Notice (공지 — 인사말 없음)</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">끝인사 · 서명</label>
        <select className="form-select" value={closing} onChange={(e) => onChange('closing', e.target.value)}>
          <option value="auto">자동 (Letter만 「여러분의 진실한,」)</option>
          <option value="sincerely">여러분의 진실한,</option>
          <option value="warmly">진심을 담아,</option>
          <option value="none">없음</option>
        </select>
        <p className="form-hint">끝인사 아래에 위 「발신」 항목이 서명으로 붙습니다.</p>
      </div>
    </div>
  )
}
