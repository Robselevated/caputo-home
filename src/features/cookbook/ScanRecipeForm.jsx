import { useEffect, useMemo, useRef, useState } from 'react'
import { Images, ScanLine } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { toast } from '../../components/ui/Toast'
import { plural } from './recipeFormat'

const canPreview = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'

// Rough wall time for one scan: a few seconds of model time plus a couple
// per photo for resizing, upload and reading.
const estimateSeconds = (count) => 4 + 2 * count

function skippedMessage(skipped) {
  const reasons = [...new Set(skipped.map(s => s.reason))]
  return `Skipped ${plural(skipped.length, 'photo')}: ${reasons.join(' ')}`
}

// Pick one or more recipe photos, then read them in one go.
// `scan(files, { signal })` resolves to { parsed, skipped, tileCount }; the
// caller decides where the parsed recipe goes (a fresh form, or merged into
// the one being edited). Cancel aborts the request and clears the picks.
export function ScanRecipeForm({ scan, onParsed, hint }) {
  const [files, setFiles] = useState([])
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef(null)
  const controllerRef = useRef(null)

  const previews = useMemo(() => (canPreview ? files.map(f => URL.createObjectURL(f)) : []), [files])
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews])
  useEffect(() => () => controllerRef.current?.abort(), [])

  const pick = (e) => {
    setFiles(Array.from(e.target.files || []))
    e.target.value = ''
  }

  const run = async () => {
    if (!files.length || scanning) return
    const controller = new AbortController()
    controllerRef.current = controller
    setScanning(true)
    try {
      const result = await scan(files, { signal: controller.signal })
      if (result.skipped?.length) toast({ message: skippedMessage(result.skipped), tone: 'error', durationMs: 7000 })
      setFiles([])
      onParsed(result)
    } catch (err) {
      if (err?.name !== 'AbortError') toast({ message: err?.message || 'Could not read those photos', tone: 'error', durationMs: 7000 })
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      setScanning(false)
    }
  }

  const cancel = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setFiles([])
    setScanning(false)
  }

  const statusLine = `Reading ${plural(files.length, 'photo')}, about ${estimateSeconds(files.length)} seconds`

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
      <input ref={inputRef} type="file" accept="image/*,image/heic" multiple onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => inputRef.current?.click()} disabled={scanning}>
          <Images size={18} aria-hidden="true" />
          {files.length ? `${plural(files.length, 'photo')} picked` : 'Choose photos'}
        </Button>
        {files.length > 0 && !scanning && <Button variant="ghost" onClick={() => setFiles([])}>Clear</Button>}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1 bg-accent-cookbook" onClick={run} disabled={!files.length || scanning}>
          <ScanLine size={18} aria-hidden="true" />
          {scanning ? 'Reading' : 'Scan photos'}
        </Button>
        {scanning && <Button variant="secondary" onClick={cancel}>Cancel</Button>}
      </div>
      {scanning && <p role="status" className="text-[13px] text-ink-2">{statusLine}</p>}
    </div>
  )
}
