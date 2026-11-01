import { Select } from 'trust-ui-react'

// 공문 머리말의 로고 표시 방식 (교회 로고 사용 제한이 있는 경우 이름만 표시)
export default function LogoStyleSelect({ value, onChange }) {
  return (
    <Select
      label="머리말 표시"
      fullWidth
      value={value || 'name'}
      onChange={onChange}
      options={[
        { value: 'name', label: '교회 이름만 (로고 이미지 없음)' },
        { value: 'full', label: '교회 로고 이미지 포함' },
      ]}
    />
  )
}
