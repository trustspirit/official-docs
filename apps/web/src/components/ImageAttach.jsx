import { useRef, useState } from 'react'
import { uploadImage } from '../api'

export const MAX_IMAGES = 6
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

// 이미지를 즉시 Storage에 올리고 { path, url, name } 목록을 부모에 전달
export default function ImageAttach({ images, onChange }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0) // 자식 요소 진입/이탈로 깜빡이지 않도록 카운트

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    processFiles(files)
  }

  const processFiles = async (all) => {
    const files = all.filter((f) => ACCEPT.includes(f.type))
    if (!files.length) {
      if (all.length) setError('PNG, JPG, GIF, WEBP 이미지 파일만 첨부할 수 있습니다.')
      return
    }
    if (uploading) return
    setError('')
    if (files.length < all.length) setError('이미지가 아닌 파일은 제외했습니다.')
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

  const onDragEnter = (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const onDragOver = (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault() // drop 허용
    e.dataTransfer.dropEffect = 'copy'
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const onDrop = (e) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    processFiles(Array.from(e.dataTransfer.files || []))
  }

  const remove = (path) => onChange(images.filter((im) => im.path !== path))

  return (
    <div className="form-group">
      <label className="form-label">
        첨부 이미지 <span style={{ fontWeight: 400, color: '#999' }}>(선택, 최대 {MAX_IMAGES}장 · 5MB 이하)</span>
      </label>
      <div
        className={`image-attach${dragging ? ' image-attach--drag' : ''}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {images.map((im) => (
          <div className="image-attach__item" key={im.path}>
            <img src={im.url} alt={im.name} />
            <button type="button" className="image-attach__remove" onClick={() => remove(im.path)} aria-label={`${im.name} 제거`}>×</button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button type="button" className="image-attach__add" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <span className="spinner" /> : <>+ 이미지 추가<br /><span style={{ fontSize: '0.68rem', color: '#999' }}>또는 끌어다 놓기</span></>}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={handleFiles} />
      </div>
      <p className="form-hint">이미지를 이 영역으로 끌어다 놓거나 버튼으로 선택하세요. 포스터·캡처 등을 올리면 AI가 내용을 읽어 공문에 반영하고, 본문의 알맞은 위치에 함께 넣습니다.</p>
      {error && <p className="form-hint" style={{ color: '#8b0000' }}>{error}</p>}
    </div>
  )
}
