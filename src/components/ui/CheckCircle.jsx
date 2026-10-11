import { Check } from 'lucide-react'

// Round check control. `ringClass` is the store accent as a border class and
// `fillClass` the same accent as a background class.
export function CheckCircle({ checked, label, ringClass, fillClass, onClick }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full -m-1 ${checked ? 'animate-check-off' : ''}`}
    >
      <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 ${ringClass} ${checked ? fillClass : 'bg-surface'}`}>
        {checked && <Check size={18} strokeWidth={2.5} className="text-white" aria-hidden="true" />}
      </span>
    </button>
  )
}
