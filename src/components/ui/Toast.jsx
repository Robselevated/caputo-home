import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

// Lightweight toast system. `toast()` can be called from anywhere (hooks,
// plain modules); <ToastProvider> renders them.

const listeners = new Set()
let nextId = 1
const MAX_VISIBLE = 2

export function toast({ message, action = null, durationMs = 4000, tone = 'default' }) {
  const id = nextId++
  const entry = { id, message, action, durationMs, tone }
  for (const listener of listeners) listener({ type: 'add', toast: entry })
  return id
}

toast.dismiss = (id) => {
  for (const listener of listeners) listener({ type: 'dismiss', id })
}

const ToastContext = createContext({ toast, dismiss: toast.dismiss })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const clearTimer = (id) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
  }

  const dismiss = useCallback((id) => {
    clearTimer(id)
    setToasts(prev => (prev.some(t => t.id === id) ? prev.filter(t => t.id !== id) : prev))
  }, [])

  useEffect(() => {
    const handle = (evt) => {
      if (evt.type === 'add') {
        setToasts(prev => {
          const next = [...prev, evt.toast]
          while (next.length > MAX_VISIBLE) clearTimer(next.shift().id)
          return next
        })
        if (evt.toast.durationMs > 0) {
          timers.current.set(evt.toast.id, setTimeout(() => dismiss(evt.toast.id), evt.toast.durationMs))
        }
      } else if (evt.type === 'dismiss') {
        dismiss(evt.id)
      }
    }
    listeners.add(handle)
    const pending = timers.current
    return () => {
      listeners.delete(handle)
      for (const t of pending.values()) clearTimeout(t)
      pending.clear()
    }
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="fixed left-0 right-0 z-[70] flex flex-col items-center gap-2 px-5 pointer-events-none bottom-[calc(76px+env(safe-area-inset-bottom,0px))]"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 w-full max-w-md rounded-row py-3 pl-4 pr-2.5 text-sm text-white shadow-toast animate-slide-down ${
              t.tone === 'error' ? 'bg-danger-ink' : 'bg-ink'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action.onClick?.(); dismiss(t.id) }}
                className="shrink-0 h-9 px-3.5 rounded-[10px] bg-white/15 font-semibold active:opacity-70"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
