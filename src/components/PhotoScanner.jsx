import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { toast } from './ui/Toast'
import { validateImageFile } from '../lib/uploadValidation'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Round camera button backed by a hidden file input (rear camera on phones).
export default function PhotoScanner({ onCapture, scanning, label = 'Scan a photo', icon: Icon = Camera, variant = 'outline', size = 44, className = '' }) {
  const fileRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const validationError = validateImageFile(file)
      if (validationError) {
        toast({ message: validationError, tone: 'error' })
      } else if (file.size > MAX_FILE_SIZE) {
        toast({ message: 'That photo is over 10MB. Try a smaller one.', tone: 'error' })
      } else {
        onCapture(file)
      }
    }
    e.target.value = ''
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      <IconButton label={scanning ? 'Scanning' : label} variant={variant} size={size} className={className} disabled={scanning} onClick={() => fileRef.current?.click()}>
        {scanning ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
        ) : (
          <Icon size={22} aria-hidden="true" />
        )}
      </IconButton>
    </>
  )
}
