import { useRef } from 'react'

export default function PhotoScanner({ onCapture, scanning, colorClass }) {
  const fileRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onCapture(file)
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
        className={`w-10 h-10 ${colorClass} text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50`}
      >
        {scanning ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </>
  )
}
