import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCharacterStore } from '@/stores/useCharacterStore'

const DIFF_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  normal:  { text: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/30' },
  heroic:  { text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  mythic:  { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface RaidEvent {
  id: string; title: string; raid_name: string; difficulty: string
  description?: string; max_raiders: number; starts_at: string
  status: string; guild_name: string; guild_realm: string
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Monday = 0, Sunday = 6 */
function getMondayBasedDay(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

export function RaidCalendarPage() {
  const active = useCharacterStore((s) => s.getActive())

  const realm = active?.guildRealm ?? active?.realm ?? ''
  const guild = active?.guild ?? ''
  const region = active?.region ?? 'eu'

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<RaidEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const loadEvents = async () => {
    if (!realm || !guild) return
    setLoading(true)
    try {
      setEvents(await api.getGuildEvents(realm, guild, region))
    } catch { /* skip */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadEvents() }, [realm, guild]) // eslint-disable-line react-hooks/exhaustive-deps

  // Group events by date key (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, RaidEvent[]>()
    for (const e of events) {
      const d = new Date(e.starts_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events])

  // Build calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = getMondayBasedDay(firstDayOfMonth)

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const calendarCells: Array<{ day: number | null; key: string }> = []
  // Empty cells before month starts
  for (let i = 0; i < startOffset; i++) {
    calendarCells.push({ day: null, key: `empty-${i}` })
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarCells.push({ day: d, key })
  }
  // Fill remaining cells to complete the last week
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push({ day: null, key: `trail-${calendarCells.length}` })
  }

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
    setSelectedDay(null)
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
    setSelectedDay(null)
  }

  const selectedEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : []

  if (!guild) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">Select a character with a guild to view the raid calendar</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={goToPrevMonth}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-white">
          {new Date(viewYear, viewMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={goToNextMonth}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {loading ? (
        <Card>
          <div className="text-center py-12 space-y-2">
            <div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 text-sm">Loading events...</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                {label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarCells.map((cell) => {
              const dayEvents = cell.day ? eventsByDay.get(cell.key) ?? [] : []
              const isToday = cell.key === todayKey
              const isSelected = cell.key === selectedDay
              const hasEvents = dayEvents.length > 0

              return (
                <div
                  key={cell.key}
                  onClick={() => { if (cell.day && hasEvents) setSelectedDay(isSelected ? null : cell.key) }}
                  className={cn(
                    'min-h-[80px] p-1.5 border-b border-r border-white/[0.03] transition-colors',
                    cell.day ? 'cursor-default' : 'bg-white/[0.01]',
                    hasEvents && 'cursor-pointer hover:bg-white/[0.03]',
                    isSelected && 'bg-white/[0.05]',
                  )}
                >
                  {cell.day && (
                    <>
                      <div className={cn(
                        'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1',
                        isToday
                          ? 'bg-[color:var(--class-color)] text-white font-bold'
                          : 'text-gray-400',
                      )}>
                        {cell.day}
                      </div>
                      {dayEvents.map((e) => {
                        const colors = DIFF_COLORS[e.difficulty] ?? DIFF_COLORS.normal
                        return (
                          <div key={e.id}
                            className={cn('rounded px-1.5 py-0.5 mb-0.5 border truncate', colors.bg, colors.border)}>
                            <span className={cn('text-[10px] font-medium leading-tight', colors.text)}>
                              {e.title}
                            </span>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Event details panel */}
      {selectedDay && selectedEvents.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {selectedEvents.map((e) => {
            const colors = DIFF_COLORS[e.difficulty] ?? DIFF_COLORS.normal
            const time = new Date(e.starts_at)
            return (
              <Card key={e.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{e.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-xs font-medium', colors.text)}>
                        {e.difficulty.charAt(0).toUpperCase() + e.difficulty.slice(1)}
                      </span>
                      <span className="text-xs text-gray-500">{e.raid_name}</span>
                    </div>
                    {e.description && (
                      <p className="text-xs text-gray-500 mt-2">{e.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-300">
                      {time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-gray-600">{e.max_raiders} max</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {events.length === 0 && !loading && (
        <Card className="p-6 text-center">
          <p className="text-gray-500">No raid events scheduled</p>
          <p className="text-gray-600 text-xs mt-1">Create events in the Signups tab</p>
        </Card>
      )}
    </div>
  )
}
