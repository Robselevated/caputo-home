import { BUILD_ID } from '../lib/buildId'

// Full-screen boot state: splash icon, one line, build id. No spinner; the
// icon is the brand and the line says what is happening.
export default function BootScreen({ heading, message, children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ground px-5 text-center">
      <img src="/splash-icon.png" alt="" width="80" height="80" className="h-20 w-20 rounded-tile shadow-soft" />
      {heading && <h1 className="mt-5 font-heading text-xl font-bold text-ink">{heading}</h1>}
      {message && <p role="status" className={`${heading ? 'mt-1.5' : 'mt-5'} text-sm text-ink-2`}>{message}</p>}
      {children}
      <p className="mt-8 text-[11px] tracking-wide text-ink-3">v{BUILD_ID}</p>
    </div>
  )
}
