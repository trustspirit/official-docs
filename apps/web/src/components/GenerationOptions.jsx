import { Select } from 'trust-ui-react'

// 생성 전에 문서 유형과 끝인사를 직접 선택 (AI 자동 판단에 맡기지 않을 수 있도록)
export default function GenerationOptions({ docTypePref, closing, onChange }) {
  return (
    <div className="form-row">
      <div className="form-group">
        <Select
          label="문서 유형 (생성 전에 선택)"
          fullWidth
          value={docTypePref}
          onChange={(v) => onChange('doc_type_pref', v)}
          options={[
            { value: 'auto', label: 'AI가 판단' },
            { value: 'Letter', label: 'Letter (서한 — 인사말 포함)' },
            { value: 'Notice', label: 'Notice (공지 — 인사말 없음)' },
          ]}
        />
      </div>
      <div className="form-group">
        <Select
          label="끝인사 · 서명"
          fullWidth
          value={closing}
          onChange={(v) => onChange('closing', v)}
          options={[
            { value: 'auto', label: '자동 (Letter만 「여러분의 진실한,」)' },
            { value: 'sincerely', label: '여러분의 진실한,' },
            { value: 'warmly', label: '진심을 담아,' },
            { value: 'none', label: '없음' },
          ]}
        />
        <p className="form-hint">끝인사 아래에 위 「발신」 항목이 서명으로 붙습니다.</p>
      </div>
    </div>
  )
}
