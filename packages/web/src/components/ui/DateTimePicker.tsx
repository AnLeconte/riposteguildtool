import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  value: string // ISO string or datetime-local format
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function startDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

export function DateTimePicker({ value, onChange, placeholder, className }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const parsed = value ? new Date(value) : null
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsed)
  const [hour, setHour] = useState(parsed ? parsed.getHours() : 21)
  const [minute, setMinute] = useState(parsed ? parsed.getMinutes() : 0)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleDayClick = (day: number) => {
    const d = new Date(viewYear, viewMonth, day, hour, minute)
    setSelectedDate(d)
    emitChange(d, hour, minute)
  }

  const emitChange = (date: Date, h: number, m: number) => {
    const d = new Date(date)
    d.setHours(h, m, 0, 0)
    // Format as datetime-local compatible string
    const pad = (n: number) => n.toString().padStart(2, '0')
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`)
  }

  const handleHourChange = (h: number) => {
    setHour(h)
    if (selectedDate) emitChange(selectedDate, h, minute)
  }

  const handleMinuteChange = (m: number) => {
    setMinute(m)
    if (selectedDate) emitChange(selectedDate, hour, m)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startDay = startDayOfMonth(viewYear, viewMonth)
  const today = new Date()

  const displayValue = parsed
    ? `${parsed.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à ${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`
    : null

  const rect = triggerRef.current?.getBoundingClientRect()

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full text-left rounded-xl bg-wow-panel/95 border border-white/[0.08] px-3.5 py-2 text-[13px] font-medium transition-all duration-200',
          'hover:border-white/[0.15] hover:bg-wow-panel',
          'focus:outline-none focus:ring-2 focus:ring-wow-gold/30 focus:border-[color:var(--class-color)]/40',
          'shadow-sm shadow-black/20',
          open && 'border-[color:var(--class-color)]/40 ring-2 ring-wow-gold/30',
          className,
        )}
      >
        <span className={displayValue ? 'text-gray-100' : 'text-gray-500'}>
          {displayValue ?? placeholder ?? 'Select date & time...'}
        </span>
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed rounded-xl border border-white/[0.08] bg-wow-panel/95 backdrop-blur-xl shadow-xl shadow-black/40 animate-fade-in p-4"
          style={{
            zIndex: 9999,
            top: rect ? rect.bottom + 6 : 0,
            left: rect ? rect.left : 0,
            width: 300,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="text-gray-500 hover:text-white transition-colors p-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-gray-200">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="text-gray-500 hover:text-white transition-colors p-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] text-gray-600 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
              const isSelected = selectedDate && day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear()
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'w-full aspect-square rounded-lg text-xs font-medium transition-all',
                    isSelected ? 'bg-[color:var(--class-color)] text-wow-darker' :
                    isToday ? 'bg-white/[0.08] text-[color:var(--class-color)]' :
                    'text-gray-400 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Time picker */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-2">
            <span className="text-[10px] text-gray-500">Heure</span>
            <select
              value={hour}
              onChange={(e) => handleHourChange(parseInt(e.target.value))}
              className="bg-wow-darker border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[color:var(--class-color)]/40"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <span className="text-gray-500 font-bold">:</span>
            <select
              value={minute}
              onChange={(e) => handleMinuteChange(parseInt(e.target.value))}
              className="bg-wow-darker border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[color:var(--class-color)]/40"
            >
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
              ))}
            </select>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
