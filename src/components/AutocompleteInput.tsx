import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  onEnter?: () => void // fired on Enter when no suggestion is highlighted
  placeholder?: string
  className?: string
}

/**
 * Text input that offers matching past values as a styled dropdown while you
 * type. Pick one to fill it, or keep typing your own text if nothing matches.
 * The dropdown is portalled to <body> so it is never clipped by table/overflow.
 */
export function AutocompleteInput({ value, onChange, suggestions, onEnter, placeholder, className }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [active, setActive] = useState(0)

  const q = value.trim().toLowerCase()
  const matches = q
    ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, 8)
    : []
  const show = open && matches.length > 0

  const place = () => ref.current && setRect(ref.current.getBoundingClientRect())

  useEffect(() => {
    if (!show) return
    place()
    const h = () => place()
    window.addEventListener('scroll', h, true)
    window.addEventListener('resize', h)
    return () => {
      window.removeEventListener('scroll', h, true)
      window.removeEventListener('resize', h)
    }
  }, [show])

  useEffect(() => setActive(0), [value])

  const pick = (s: string) => {
    onChange(s)
    setOpen(false)
  }

  return (
    <>
      <input
        ref={ref}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          place()
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (show && e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, matches.length - 1))
          } else if (show && e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (show && e.key === 'Enter') {
            e.preventDefault()
            pick(matches[active])
          } else if (e.key === 'Enter') {
            onEnter?.()
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {show &&
        rect &&
        createPortal(
          <ul
            className="z-50 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
            style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 220) }}
          >
            {matches.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-brand-50 ${
                    i === active ? 'bg-brand-50' : ''
                  }`}
                  // onMouseDown fires before the input's blur, so the pick lands.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(s)
                  }}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{s}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
