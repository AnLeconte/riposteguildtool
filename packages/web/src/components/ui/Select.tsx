import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
  icon?: string
  group?: string
}

interface SelectProps {
  value: string | number
  onChange: (e: { target: { value: string } }) => void
  children: ReactNode
  className?: string
  placeholder?: string
}

export function Select({ value, onChange, children, className, placeholder }: SelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const options = parseChildren(children)
  const selected = options.find((o) => o.value === String(value))

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (val: string) => {
    onChange({ target: { value: val } })
    setOpen(false)
  }

  const groups = new Map<string, SelectOption[]>()
  for (const opt of options) {
    const g = opt.group ?? ''
    groups.set(g, [...(groups.get(g) ?? []), opt])
  }

  const rect = triggerRef.current?.getBoundingClientRect()

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(
          'w-full text-left rounded-xl bg-wow-panel/95 border border-white/[0.08] px-3.5 py-2 text-[13px] font-medium text-gray-100 transition-all duration-200',
          'hover:border-white/[0.15] hover:bg-wow-panel',
          'focus:outline-none focus:ring-2 focus:ring-wow-gold/30 focus:border-[color:var(--class-color)]/40',
          'shadow-sm shadow-black/20',
          'flex items-center justify-between gap-2',
          open && 'border-[color:var(--class-color)]/40 ring-2 ring-wow-gold/30',
        )}>
        <span className={cn('flex items-center gap-2', selected ? 'text-gray-100' : 'text-gray-500')}>
          {selected?.icon && <img src={selected.icon} alt="" className="w-5 h-5 rounded border border-white/[0.1]" />}
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <svg className={cn('w-3 h-3 text-gray-500 transition-transform flex-shrink-0', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed py-1 rounded-xl border border-white/[0.08] bg-wow-panel/95 backdrop-blur-xl shadow-xl shadow-black/40 animate-fade-in max-h-64 overflow-y-auto"
          style={{
            zIndex: 9999,
            top: rect ? rect.bottom + 6 : 0,
            left: rect ? rect.left : 0,
            width: rect ? Math.max(rect.width, 200) : 'auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {[...groups.entries()].map(([group, opts]) => (
            <div key={group}>
              {group && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">{group}</div>
              )}
              {opts.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full text-left px-3.5 py-2 text-[13px] font-medium transition-colors flex items-center gap-2',
                    opt.value === String(value)
                      ? 'text-[color:var(--class-color)] bg-[color:var(--class-color)]/[0.06]'
                      : 'text-gray-300 hover:text-white hover:bg-white/[0.04]',
                  )}>
                  {opt.icon && <img src={opt.icon} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />}
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

/** Parse <option> and <optgroup> React children into flat option list */
function parseChildren(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = []
  const arr = Array.isArray(children) ? children : [children]

  for (const child of arr.flat(3)) {
    if (!child || typeof child !== 'object' || !('props' in child)) continue

    if (child.type === 'optgroup') {
      const groupLabel = child.props.label ?? ''
      const groupChildren = Array.isArray(child.props.children) ? child.props.children : [child.props.children]
      for (const opt of groupChildren.flat()) {
        if (opt?.props?.value !== undefined) {
          const rawLabel = opt.props.children ?? opt.props.value
          const label = Array.isArray(rawLabel) ? rawLabel.join('') : String(rawLabel)
          options.push({
            value: String(opt.props.value),
            label,
            icon: opt.props['data-icon'] ?? undefined,
            group: groupLabel,
          })
        }
      }
    } else if (child.type === 'option') {
      const rawLabel = child.props.children ?? child.props.value ?? ''
      const label = Array.isArray(rawLabel) ? rawLabel.join('') : String(rawLabel)
      options.push({
        value: String(child.props.value ?? ''),
        label,
        icon: child.props['data-icon'] ?? undefined,
      })
    }
  }

  return options
}
