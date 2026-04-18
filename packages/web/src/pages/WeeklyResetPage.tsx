import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface VaultSlot { type: string; threshold: number; current: number; unlocked: boolean }

function getNextReset(): Date {
  // EU reset is Wednesday 09:00 CET
  const now = new Date()
  const day = now.getUTCDay()
  const daysUntilWed = (3 - day + 7) % 7 || 7
  const reset = new Date(now)
  reset.setUTCDate(now.getUTCDate() + daysUntilWed)
  reset.setUTCHours(7, 0, 0, 0) // 07:00 UTC = 09:00 CET
  if (reset <= now) reset.setUTCDate(reset.getUTCDate() + 7)
  return reset
}

function formatTimeUntil(target: Date): string {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return 'Reset now!'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const STORAGE_KEY = 'weekly-checklist'

interface ChecklistItem { id: string; label: string; done: boolean }

function loadChecklist(): ChecklistItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'vault-m1', label: 'M+ Vault Slot 1 (1 dungeon)', done: false },
  { id: 'vault-m2', label: 'M+ Vault Slot 2 (4 dungeons)', done: false },
  { id: 'vault-m3', label: 'M+ Vault Slot 3 (8 dungeons)', done: false },
  { id: 'vault-r1', label: 'Raid Vault Slot 1 (2 bosses)', done: false },
  { id: 'vault-r2', label: 'Raid Vault Slot 2 (4 bosses)', done: false },
  { id: 'vault-r3', label: 'Raid Vault Slot 3 (6 bosses)', done: false },
  { id: 'vault-w1', label: 'World Vault Slot 1', done: false },
  { id: 'weekly-quest', label: 'Weekly quest (Theater Troupe / Delves)', done: false },
  { id: 'great-vault', label: 'Open Great Vault', done: false },
  { id: 'catalyst', label: 'Use Catalyst charge', done: false },
]

export function WeeklyResetPage() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    const saved = loadChecklist()
    return saved.length > 0 ? saved : DEFAULT_CHECKLIST
  })
  const [newItem, setNewItem] = useState('')

  const active = useCharacterStore((s) => s.getActive())

  // M+ data from character
  const [realm, setRealm] = useState(active?.realm ?? 'hyjal')
  const [name, setName] = useState(active?.name ?? '')
  const [charData, setCharData] = useState<any>(null)
  const [charLoading, setCharLoading] = useState(false)

  // Auto-load active character
  useEffect(() => {
    if (active && !charData) {
      setRealm(active.realm)
      setName(active.name)
      loadCharacterData(active.realm, active.name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCharacterData = async (r: string, n: string) => {
    if (!r.trim() || !n.trim()) return
    setCharLoading(true)
    try { setCharData(await api.getCharacterProfile(r, n, active?.region ?? 'eu')) } catch { /* skip */ }
    finally { setCharLoading(false) }
  }

  const reset = getNextReset()
  const doneCount = checklist.filter((c) => c.done).length

  const toggle = (id: string) => {
    const updated = checklist.map((c) => c.id === id ? { ...c, done: !c.done } : c)
    setChecklist(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const addItem = () => {
    if (!newItem.trim()) return
    const item: ChecklistItem = { id: Math.random().toString(36).slice(2), label: newItem.trim(), done: false }
    const updated = [...checklist, item]
    setChecklist(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setNewItem('')
  }

  const removeItem = (id: string) => {
    const updated = checklist.filter((c) => c.id !== id)
    setChecklist(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const resetChecklist = () => {
    const updated = checklist.map((c) => ({ ...c, done: false }))
    setChecklist(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const loadCharacter = () => loadCharacterData(realm, name)

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Weekly" highlight="Reset" description="Track your weekly objectives before reset" />
      </div>

      {/* Reset timer */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Reset</p>
            <p className="text-lg font-bold text-[color:var(--class-color)] mt-0.5">{formatTimeUntil(reset)}</p>
            <p className="text-[10px] text-gray-600">
              {reset.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at {reset.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-300">{doneCount}<span className="text-gray-600">/{checklist.length}</span></p>
            <p className="text-[10px] text-gray-600">completed</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-wow-darker rounded-full overflow-hidden">
          <div className="h-full bg-[color:var(--class-color)]/60 rounded-full transition-all" style={{ width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%` }} />
        </div>
      </Card>

      {/* Character M+ info */}
      <Card className="p-4 space-y-3">
        <label className="text-xs font-medium text-gray-400">Character M+ This Week</label>
        <div className="flex gap-2">
          <Input value={realm} onChange={(e) => setRealm(e.target.value)} placeholder="Realm" className="w-32" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="flex-1" />
          <Button variant="secondary" size="sm" onClick={loadCharacter} disabled={charLoading}>
            {charLoading ? '...' : 'Load'}
          </Button>
        </div>
        {charData?.mythicPlus?.runs?.length > 0 && (
          <div className="space-y-1 mt-2">
            <p className="text-xs text-gray-400">{charData.mythicPlus.runs.length} runs this week</p>
            {charData.mythicPlus.runs.sort((a: any, b: any) => b.level - a.level).slice(0, 8).map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`font-bold tabular-nums w-6 ${r.timed ? 'text-[color:var(--class-color)]' : 'text-gray-500'}`}>+{r.level}</span>
                <span className="text-gray-400">{r.dungeon}</span>
                <span className={`text-[10px] ${r.timed ? 'text-green-400' : 'text-red-400/70'}`}>{r.timed ? 'Timed' : 'Depleted'}</span>
              </div>
            ))}
          </div>
        )}
        {charData && charData.mythicPlus?.runs?.length === 0 && (
          <p className="text-xs text-gray-600">No M+ runs this week</p>
        )}
      </Card>

      {/* Checklist */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Weekly Checklist</h3>
          <Button variant="ghost" size="sm" onClick={resetChecklist}>Reset All</Button>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group">
              <button onClick={() => toggle(item.id)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  item.done ? 'bg-[color:var(--class-color)]/20 border-[color:var(--class-color)] text-[color:var(--class-color)]' : 'border-gray-600 hover:border-gray-400'
                }`}>
                {item.done && <span className="text-[10px]">&#10003;</span>}
              </button>
              <span className={`text-sm flex-1 ${item.done ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                {item.label}
              </span>
              <button onClick={() => removeItem(item.id)}
                className="text-[10px] text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                &#10005;
              </button>
            </div>
          ))}
        </div>
        {/* Add custom item */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex gap-2">
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add custom task..." className="flex-1 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && addItem()} />
            <Button variant="ghost" size="sm" onClick={addItem}>Add</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
