import { Button, SegmentedControl } from 'trust-ui-react'
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
        added.push({ path: up.path, url: up.url, name: f.name, mode: 'inline' })
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

  const setMode = (path, mode) =>
    onChange(images.map((im) => (im.path === path ? { ...im, mode } : im)))

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
        {images.map((im) => {
          const mode = im.mode || 'inline'
          return (
            <div className="image-attach__card" key={im.path}>
              <div className="image-attach__item">
                <img src={im.url} alt={im.name} />
                <button type="button" className="image-attach__remove" onClick={() => remove(im.path)} aria-label={`${im.name} 제거`}>×</button>
              </div>
              <SegmentedControl
                size="sm"
                aria-label={`${im.name} 사용 방식`}
                value={mode}
                onChange={(m) => setMode(im.path, m)}
                options={[
                  { value: 'inline', label: '본문' },
                  { value: 'attachment', label: '첨부' },
                ]}
              />
            </div>
          )
        })}
        {images.length < MAX_IMAGES && (
          <Button variant="outline" className="image-attach__add" onClick={() => inputRef.current?.click()} loading={uploading} disabled={uploading}>
            + 이미지 추가
          </Button>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={handleFiles} />
      </div>
      <p className="form-hint">이미지를 이 영역으로 끌어다 놓거나 버튼으로 선택하세요. 어느 쪽이든 AI가 이미지 내용을 읽어 공문에 반영합니다. 「본문」은 공문 중간에 넣고, 「첨부」는 공문 뒤에 별도 첨부 페이지로 붙입니다. 방식을 바꾼 뒤에는 다시 생성해야 반영됩니다.</p>
      {error && <p className="form-hint" style={{ color: '#8b0000' }}>{error}</p>}
    </div>
  )
}
