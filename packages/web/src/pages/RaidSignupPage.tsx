import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Select } from '@/components/ui/Select'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useClassIcons } from '@/hooks/useClassIcons'
import { cn } from '@/lib/utils'
import { showNotification, requestNotificationPermission } from '@/lib/notifications'
import { cachedImg } from '@/lib/cached-image'
import { Modal } from '@/components/ui/Modal'

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C69B6D', Paladin: '#F48CBA', Hunter: '#AAD372', Rogue: '#FFF468',
  Priest: '#FFFFFF', 'Death Knight': '#C41E3A', Shaman: '#0070DD', Mage: '#3FC7EB',
  Warlock: '#8788EE', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
}

const DIFF_COLORS: Record<string, string> = {
  normal: 'text-green-400', heroic: 'text-purple-400', mythic: 'text-orange-400',
}

const CONFIRM_OPTIONS: Array<{ value: string; label: string; color: string; bg: string }> = [
  { value: 'pending', label: 'Waiting', color: 'text-gray-500', bg: 'bg-white/[0.03]' },
  { value: 'confirmed', label: 'Confirmé', color: 'text-green-400', bg: 'bg-green-500/10' },
  { value: 'benched', label: 'Bench', color: 'text-red-400', bg: 'bg-red-500/10' },
  { value: 'standby', label: 'Standby', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
]

const CONFIRM_LABELS: Record<string, string> = Object.fromEntries(CONFIRM_OPTIONS.map(o => [o.value, o.label]))

function StatusDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = CONFIRM_OPTIONS.find(o => o.value === value) ?? CONFIRM_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={cn('text-[10px] font-medium px-2.5 py-1 rounded flex items-center gap-1 transition-colors min-h-[28px]', current.color, current.bg, 'hover:brightness-125')}
      >
        {current.label}
        <svg className={cn('w-2.5 h-2.5 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-28 py-1 rounded-lg border border-white/[0.08] bg-wow-panel/95 backdrop-blur-xl shadow-lg shadow-black/30 animate-fade-in-down z-50">
          {CONFIRM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-[10px] font-medium transition-colors',
                value === opt.value ? cn(opt.color, 'bg-white/[0.04]') : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface RaidEvent {
  id: string; title: string; raid_name: string; difficulty: string
  description?: string; max_raiders: number; starts_at: string
  status: string; guild_name: string; guild_realm: string
}

interface Signup {
  id: string; user_id: string; character_name: string; wow_class: string
  spec?: string; role: string; status: string; note?: string; confirmed: string
}

interface EventDetail extends RaidEvent {
  signups: Signup[]
  grouped: { tanks: Signup[]; healers: Signup[]; dps: Signup[] }
  counts: { total: number; present: number; absent: number; tentative: number; confirmed: number }
}

export function RaidSignupPage() {
  const active = useCharacterStore((s) => s.getActive())
  const user = useAuthStore((s) => s.user)
  const { getSpecIcon } = useClassIcons()

  const realm = active?.guildRealm ?? active?.realm ?? ''
  const guild = active?.guild ?? ''
  const region = active?.region ?? 'eu'

  const [events, setEvents] = useState<RaidEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [raids, setRaids] = useState<Array<{ id: number; name: string; image_url?: string }>>([])
  const [error, setError] = useState<string | null>(null)

  // Load raid list with banners
  useEffect(() => {
    api.getRaids('raid').then((list) => {
      // Fetch each raid to get image_url
      Promise.all(list.map((r: any) => api.getRaid(r.id).then((d: any) => ({ id: r.id, name: r.name, image_url: d.image_url })).catch(() => ({ id: r.id, name: r.name }))))
        .then(setRaids)
    }).catch(() => {})
  }, [])

  // Create form
  const [title, setTitle] = useState('')
  const [raidName, setRaidName] = useState('The Voidspire')
  const [difficulty, setDifficulty] = useState('heroic')
  const [startsAt, setStartsAt] = useState('')
  const [maxRaiders, setMaxRaiders] = useState(25)

  // Request notification permission on mount
  useEffect(() => { requestNotificationPermission() }, [])

  const loadEvents = async () => {
    if (!realm || !guild) return
    setLoading(true)
    try {
      const data = await api.getGuildEvents(realm, guild, region)
      setEvents(data)
    } catch { /* skip */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadEvents() }, [realm, guild]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for upcoming raids and notify
  useEffect(() => {
    if (events.length === 0) return
    const now = Date.now()
    const twoHours = 2 * 60 * 60 * 1000
    for (const e of events) {
      const startsIn = new Date(e.starts_at).getTime() - now
      if (startsIn > 0 && startsIn < twoHours) {
        const mins = Math.round(startsIn / 60000)
        const notifKey = `raid-reminder-${e.id}`
        if (!sessionStorage.getItem(notifKey)) {
          sessionStorage.setItem(notifKey, '1')
          showNotification('Raid Soon!', { body: `${e.title} starts in ${mins} minutes`, tag: notifKey })
        }
      }
    }
  }, [events])

  const loadEvent = async (eventId: string) => {
    if (!realm || !guild) return
    try {
      setSelectedEvent(await api.getGuildEvent(realm, guild, eventId, region))
    } catch { /* skip */ }
  }

  const handleCreate = async () => {
    if (!realm || !guild || !title || !startsAt) return
    setError(null)
    try {
      await api.createGuildEvent(realm, guild, {
        title, raid_name: raidName, difficulty,
        starts_at: new Date(startsAt).toISOString(),
        max_raiders: maxRaiders,
      }, region)
      setShowCreate(false)
      setTitle('')
      showNotification('Raid Event Created', { body: `${title} — ${raidName} (${difficulty})` })
      loadEvents()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create event')
    }
  }

  const handleSignup = async (eventId: string, status: 'present' | 'absent' | 'tentative') => {
    if (!active) return
    // Optimistic update
    if (selectedEvent && selectedEvent.id === eventId) {
      const optimisticSignup = {
        id: `temp-${Date.now()}`,
        character_name: active.name,
        character_realm: active.realm,
        wow_class: active.class,
        spec: active.spec,
        role: 'dps',
        status,
        confirmed: 'pending',
      }
      setSelectedEvent((prev: any) => prev ? {
        ...prev,
        signups: [...(prev.signups ?? []).filter((s: any) => s.character_name !== active.name), optimisticSignup],
      } : prev)
    }
    try {
      await api.signupForEvent(realm, guild, eventId, {
        character_name: active.name,
        character_realm: active.realm,
        wow_class: active.class,
        spec: active.spec,
        role: 'dps',
        status,
      }, region)
      loadEvent(eventId)
    } catch {
      loadEvent(eventId) // revert on error
    }
  }

  const handleConfirm = async (eventId: string, signupId: string, confirmed: string) => {
    // Optimistic update
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev: any) => prev ? {
        ...prev,
        signups: (prev.signups ?? []).map((s: any) => s.id === signupId ? { ...s, confirmed } : s),
      } : prev)
    }
    try {
      await api.confirmEventSignup(realm, guild, eventId, signupId, confirmed, region)
      loadEvent(eventId)
    } catch {
      loadEvent(eventId) // revert on error
    }
  }

  const handleDelete = async (eventId: string) => {
    setError(null)
    try {
      await api.deleteGuildEvent(realm, guild, eventId, region)
      setSelectedEvent(null)
      setDeleteConfirmId(null)
      loadEvents()
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete event')
    }
  }

  if (!guild) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">Select a character with a guild to manage raid signups</p>
      </Card>
    )
  }

  // Event detail view
  if (selectedEvent) {
    const e = selectedEvent
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedEvent(null)} className="text-xs text-gray-500 hover:text-[color:var(--class-color)] transition-colors">
            &larr; Back to events
          </button>
          <button onClick={() => setDeleteConfirmId(e.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">
            Delete event
          </button>
        </div>

        <Card className="p-0 overflow-hidden">
          {(() => {
            const raidBanner = cachedImg(raids.find((r) => r.name === e.raid_name)?.image_url)
            return raidBanner ? (
              <div className="h-28 overflow-hidden relative">
                <img src={raidBanner} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-wow-panel to-transparent" />
              </div>
            ) : null
          })()}
          <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">{e.title}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs font-medium ${DIFF_COLORS[e.difficulty] ?? 'text-gray-400'}`}>
                  {e.difficulty.charAt(0).toUpperCase() + e.difficulty.slice(1)}
                </span>
                <span className="text-xs text-gray-500">{e.raid_name}</span>
                <span className="text-xs text-gray-600">
                  {new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(e.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[color:var(--class-color)]">{e.counts.present}<span className="text-gray-600 text-sm">/{e.max_raiders}</span></p>
              <p className="text-[10px] text-gray-600">signups</p>
            </div>
          </div>

          {/* Quick signup buttons */}
          {active && (
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => handleSignup(e.id, 'present')} className="flex-1">Present</Button>
              <Button size="sm" variant="secondary" onClick={() => handleSignup(e.id, 'tentative')} className="flex-1">Tentative</Button>
              <Button size="sm" variant="ghost" onClick={() => handleSignup(e.id, 'absent')} className="flex-1">Absent</Button>
            </div>
          )}
          </div>
        </Card>

        {/* Roster by role */}
        {(['tanks', 'healers', 'dps'] as const).map((role) => {
          const list = e.grouped[role].filter((s) => s.status === 'present' || s.status === 'tentative')
          if (list.length === 0) return null
          return (
            <Card key={role} className="p-0">
              <div className="px-4 py-2.5 border-b border-white/[0.06]">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {role} ({list.length})
                </h3>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {list.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    {getSpecIcon(s.wow_class, s.spec ?? '') ? (
                      <img src={getSpecIcon(s.wow_class, s.spec ?? '')} alt="" className="w-6 h-6 rounded border border-white/[0.1]" />
                    ) : (
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: CLASS_COLORS[s.wow_class] ?? '#888' }} />
                    )}
                    <span className="text-sm font-medium flex-1" style={{ color: CLASS_COLORS[s.wow_class] ?? '#ccc' }}>
                      {s.character_name}
                    </span>
                    <span className="text-[10px] text-gray-500">{s.spec} {s.wow_class}</span>
                    {s.status === 'tentative' && (
                      <span className="text-[9px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">Tentative</span>
                    )}
                    <StatusDropdown
                      value={s.confirmed ?? 'pending'}
                      onChange={(v) => handleConfirm(e.id, s.id, v)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )
        })}

        {/* Absent */}
        {e.signups.filter((s) => s.status === 'absent').length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Absent ({e.signups.filter((s) => s.status === 'absent').length})</p>
            <div className="flex flex-wrap gap-1.5">
              {e.signups.filter((s) => s.status === 'absent').map((s) => (
                <span key={s.id} className="text-[10px] text-gray-600 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
                  {s.character_name}
                </span>
              ))}
            </div>
          </div>
        )}

        <Modal
          open={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete this event?"
          description="This will permanently delete the event, all signups, and remove the Discord message."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        />
      </div>
    )
  }

  // Event list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Raid Events</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Event'}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border bg-red-500/10 border-red-500/20 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">&#10005;</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (() => {
        const selectedRaid = raids.find((r) => r.name === raidName)
        const bannerUrl = cachedImg(selectedRaid?.image_url)
        return (
        <Card className="p-0 overflow-hidden space-y-0">
          {/* Raid banner */}
          {bannerUrl && (
            <div className="h-32 overflow-hidden relative">
              <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-wow-panel to-transparent" />
            </div>
          )}
          <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wednesday raid" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Raid</label>
              <Select value={raidName} onChange={(e) => setRaidName(e.target.value)}>
                {raids.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Difficulty</label>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="heroic">Heroic</option>
                <option value="mythic">Mythic</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Max Raiders</label>
              <Input type="number" value={maxRaiders} onChange={(e) => setMaxRaiders(parseInt(e.target.value) || 25)} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-gray-400">Date & Time</label>
              <DateTimePicker value={startsAt} onChange={setStartsAt} placeholder="Choose raid date and time..." />
            </div>
          </div>
          <Button onClick={handleCreate} className="w-full">Create Event</Button>
          </div>
        </Card>
        )
      })()}

      {/* Events list */}
      {loading ? (
        <Card>
          <div className="text-center py-8">
            <div className="w-5 h-5 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
          </div>
        </Card>
      ) : events.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-gray-500">No raid events yet</p>
          <p className="text-gray-600 text-xs mt-1">Create one to start collecting signups</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const date = new Date(e.starts_at)
            const isPast = date < new Date()
            return (
              <div key={e.id}
                className={cn('rounded-xl border border-white/[0.06] bg-wow-panel/40 px-4 py-3 hover:border-[color:var(--class-color)]/20 transition-all',
                  isPast && 'opacity-50')}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => loadEvent(e.id)}>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{e.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium ${DIFF_COLORS[e.difficulty] ?? 'text-gray-400'}`}>
                        {e.difficulty.charAt(0).toUpperCase() + e.difficulty.slice(1)}
                      </span>
                      <span className="text-[10px] text-gray-600">{e.raid_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-gray-600">
                        {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={(ev) => { ev.stopPropagation(); setDeleteConfirmId(e.id) }}
                      className="text-gray-700 hover:text-red-400 transition-colors text-xs ml-2">
                      &#10005;
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete this event?"
        description="This will permanently delete the event, all signups, and remove the Discord message."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
      />
    </div>
  )
}
