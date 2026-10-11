import { useEffect, useMemo, useRef, useState } from 'react'
import { Images, ScanLine } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { toast } from '../../components/ui/Toast'
import { plural } from './recipeFormat'

const canPreview = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'

// Pick one or more recipe photos, then read them. `scan(files)` resolves to
// { parsed, sourceImageUrls, warning }; the caller decides where the parsed
// recipe goes (a fresh form, or merged into the one being edited).
export function ScanRecipeForm({ scan, onParsed, hint }) {
  const [files, setFiles] = useState([])
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef(null)

  const previews = useMemo(() => (canPreview ? files.map(f => URL.createObjectURL(f)) : []), [files])
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews])

  const pick = (e) => {
    setFiles(Array.from(e.target.files || []))
    e.target.value = ''
  }

  const run = async () => {
    if (!files.length) return
    setScanning(true)
    try {
      const result = await scan(files)
      if (result.warning) toast({ message: result.warning, tone: 'error', durationMs: 7000 })
      setFiles([])
      onParsed(result)
    } catch (err) {
      toast({ message: err.message || 'Could not read those photos', tone: 'error', durationMs: 7000 })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {hint && <p className="text-[13px] text-ink-2">{hint}</p>}
      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {previews.map((src, i) => (
            <img key={src} src={src} alt={`Photo ${i + 1}`} className="h-16 w-16 shrink-0 rounded-sm2 object-cover" />
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => inputRef.current?.click()} disabled={scanning}>
          <Images size={18} aria-hidden="true" />
          {files.length ? `${plural(files.length, 'photo')} picked` : 'Choose photos'}
        </Button>
        {files.length > 0 && <Button variant="ghost" onClick={() => setFiles([])} disabled={scanning}>Clear</Button>}
      </div>
      <Button className="bg-accent-cookbook" onClick={run} disabled={!files.length || scanning}>
        <ScanLine size={18} aria-hidden="true" />
        {scanning ? `Reading ${plural(files.length, 'photo')}` : 'Scan photos'}
      </Button>
    </div>
  )
}
