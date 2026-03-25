import { useState, useRef, useEffect } from 'react'

export default function ItemAutocomplete({ value, onChange, suggestions, placeholder }) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filtered, setFiltered] = useState([])
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (value && value.length >= 1) {
      const matches = suggestions(value)
      setFiltered(matches)
      setShowSuggestions(matches.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [value, suggestions])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (filtered.length > 0) setShowSuggestions(true)
        }}
        placeholder={placeholder}
        className="input-field focus:ring-section-grocery"
      />
      {showSuggestions && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-dark-surface border border-warmgray-100 rounded-2xl shadow-dark-md max-h-40 overflow-y-auto">
          {filtered.map((name) => (
            <li
              key={name}
              className="px-4 py-3 text-sm hover:bg-cream active:bg-warmgray-100 cursor-pointer text-charcoal"
              onMouseDown={() => {
                onChange(name)
                setShowSuggestions(false)
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
