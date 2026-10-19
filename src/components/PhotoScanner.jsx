import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { toast } from './ui/Toast'

// The photo is shrunk to a small JPEG before it is sent (useScanSession), so
// a full-size phone photo is fine here; this only stops something absurd.
const MAX_FILE_SIZE = 25 * 1024 * 1024

// Round camera button backed by a hidden file input (rear camera on phones).
export default function PhotoScanner({ onCapture, scanning, label = 'Scan a photo', icon: Icon = Camera, variant = 'outline', size = 44, className = '' }) {
  const fileRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type && !file.type.startsWith('image/')) {
        toast({ message: 'Pick a photo to scan.', tone: 'error' })
      } else if (file.size > MAX_FILE_SIZE) {
        toast({ message: 'That photo is too large. Try a smaller one.', tone: 'error' })
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
