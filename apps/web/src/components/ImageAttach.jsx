import { useRef, useState } from 'react'
import { uploadImage } from '../api'

export const MAX_IMAGES = 6
const MAX_BYTES = 5 * 1024 * 1024

// 이미지를 즉시 Storage에 올리고 { path, url, name } 목록을 부모에 전달
export default function ImageAttach({ images, onChange }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setError('')
    if (images.length + files.length > MAX_IMAGES) {
      setError(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`)
      return
    }
    const tooBig = files.find((f) => f.size > MAX_BYTES)
    if (tooBig) {
      setError(`${tooBig.name}: 5MB 이하만 업로드할 수 있습니다.`)
      return
    }
    setUploading(true)
    const added = []
    try {
      for (const f of files) {
        const up = await uploadImage(f)
        added.push({ path: up.path, url: up.url, name: f.name })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      if (added.length) onChange([...images, ...added])
      setUploading(false)
    }
  }

  const remove = (path) => onChange(images.filter((im) => im.path !== path))

  return (
    <div className="form-group">
      <label className="form-label">
        첨부 이미지 <span style={{ fontWeight: 400, color: '#999' }}>(선택, 최대 {MAX_IMAGES}장 · 5MB 이하)</span>
      </label>
      <div className="image-attach">
        {images.map((im) => (
          <div className="image-attach__item" key={im.path}>
            <img src={im.url} alt={im.name} />
            <button type="button" className="image-attach__remove" onClick={() => remove(im.path)} aria-label={`${im.name} 제거`}>×</button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button type="button" className="image-attach__add" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <span className="spinner" /> : '+ 이미지 추가'}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={handleFiles} />
      </div>
      <p className="form-hint">포스터·캡처 등을 올리면 AI가 내용을 읽어 공문에 반영하고, 본문의 알맞은 위치에 함께 넣습니다.</p>
      {error && <p className="form-hint" style={{ color: '#8b0000' }}>{error}</p>}
    </div>
  )
}
