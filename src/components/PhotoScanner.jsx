import { useRef } from 'react'
import { validateImageFile } from '../lib/uploadValidation'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function PhotoScanner({ onCapture, scanning, colorClass, icon = 'photo_camera' }) {
  const fileRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const validationError = validateImageFile(file)
      if (validationError) {
        alert(validationError)
        e.target.value = ''
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        alert('Image is too large. Please use an image under 10MB.')
        e.target.value = ''
        return
      }
      onCapture(file)
    }
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className={`w-10 h-10 ${colorClass} text-white rounded-full flex items-center justify-center shadow-dark active:scale-95 transition-transform disabled:opacity-50`}
      >
        {scanning ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="material-symbols-outlined text-xl">{icon}</span>
        )}
      </button>
    </>
  )
}
