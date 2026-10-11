import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'
import { validateImageFile } from '../../lib/uploadValidation'
import { uploadDishImage } from './recipeScan'

// Photo of the finished dish: upload to storage, or paste a link.
export function DishImageField({ value, onChange, householdId, pathPrefix, idPrefix }) {
  const [uploading, setUploading] = useState(false)
  const [broken, setBroken] = useState(false)
  const inputRef = useRef(null)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const invalid = validateImageFile(file)
    if (invalid) { toast({ message: invalid, tone: 'error', durationMs: 7000 }); return }
    setUploading(true)
    try {
      onChange(await uploadDishImage(file, householdId, pathPrefix))
      setBroken(false)
    } catch (err) {
      toast({ message: err.message, tone: 'error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-ink-2">Photo of the dish</span>
      {value && !broken && (
        <img src={value} alt="The finished dish" className="aspect-[16/9] w-full rounded-row bg-control object-cover" onError={() => setBroken(true)} />
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <ImagePlus size={18} aria-hidden="true" />
          {uploading ? 'Uploading' : value ? 'Replace photo' : 'Upload a photo'}
        </Button>
        {value && <Button variant="danger" onClick={() => { onChange(''); setBroken(false) }}>Remove</Button>}
      </div>
      <Field label="Or paste an image link" htmlFor={`${idPrefix}-image-url`}>
        <Input id={`${idPrefix}-image-url`} type="url" inputMode="url" value={value} onChange={(e) => { onChange(e.target.value); setBroken(false) }} placeholder="https://" autoComplete="off" />
      </Field>
    </div>
  )
}
