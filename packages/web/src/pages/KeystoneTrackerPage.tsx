import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface KeystoneEntry {
  id: string
  player: string
  class: string
  dungeon: string
  level: number
}

const STORAGE_KEY = 'keystone-tracker'
const uid = () => Math.random().toString(36).slice(2, 10)
function loadKeys(): KeystoneEntry[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
function saveKeys(k: KeystoneEntry[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(k)) }

const DUNGEONS = [
  'Windrunner Spire', 'Murder Row', 'Den of Nalorakk', 'Maisara Caverns',
  "Magisters' Terrace", 'Pit of Saron', 'Seat of the Triumvirate', 'Skyreach',
]

const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41F3B', 'Demon Hunter': '#A330C9', Druid: '#FF7D0A', Evoker: '#33937F',
  Hunter: '#ABD473', Mage: '#69CCF0', Monk: '#00FF96', Paladin: '#F58CBA',
  Priest: '#FFFFFF', Rogue: '#FFF569', Shaman: '#0070DE', Warlock: '#9482C9', Warrior: '#C79C6E',
}
const CLASSES = Object.keys(CLASS_COLORS)

export function KeystoneTrackerPage() {
  const [keys, setKeys] = useState<KeystoneEntry[]>(loadKeys)
  const [player, setPlayer] = useState('')
  const [cls, setCls] = useState('Warrior')
  const [dungeon, setDungeon] = useState(DUNGEONS[0])
  const [level, setLevel] = useState('')

  useEffect(() => { saveKeys(keys) }, [keys])

  const addKey = () => {
    if (!player.trim() || !level) return
    const lvl = parseInt(level, 10)
    if (lvl < 2 || lvl > 30) return
    // Update existing or add new
    setKeys((prev) => {
      const existing = prev.findIndex((k) => k.player.toLowerCase() === player.trim().toLowerCase())
      if (existing >= 0) {
        return prev.map((k, i) => i === existing ? { ...k, dungeon, level: lvl, class: cls } : k)
      }
      return [...prev, { id: uid(), player: player.trim(), class: cls, dungeon, level: lvl }]
    })
    setPlayer('')
    setLevel('')
  }

  const removeKey = (id: string) => setKeys((prev) => prev.filter((k) => k.id !== id))
  const clearAll = () => setKeys([])

  const sorted = [...keys].sort((a, b) => b.level - a.level)

  // Group by dungeon for summary
  const dungeonCounts = new Map<string, number>()
  for (const k of keys) dungeonCounts.set(k.dungeon, (dungeonCounts.get(k.dungeon) ?? 0) + 1)

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Keystone <span className="text-[color:var(--class-color)]">Tracker</span></h1>
          <p className="text-gray-500 text-sm mt-1">Track your guild's available keystones this week</p>
        </div>
        {keys.length > 0 && <Button variant="ghost" size="sm" onClick={clearAll}>Clear All</Button>}
      </div>

      {/* Add keystone */}
      <Card className="p-4">
        <div className="flex gap-2 flex-wrap">
          <Input value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Player" className="w-32"
            onKeyDown={(e) => e.key === 'Enter' && addKey()} />
          <Select value={cls} onChange={(e) => setCls(e.target.value)}
            >
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={dungeon} onChange={(e) => setDungeon(e.target.value)}
            >
            {DUNGEONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Input value={level} onChange={(e) => setLevel(e.target.value)} type="number" min={2} max={30} placeholder="Lvl" className="w-16"
            onKeyDown={(e) => e.key === 'Enter' && addKey()} />
          <Button onClick={addKey} size="sm">Add</Button>
        </div>
      </Card>

      {/* Dungeon summary */}
      {keys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {DUNGEONS.map((d) => {
            const count = dungeonCounts.get(d) ?? 0
            return (
              <span key={d} className={`text-[10px] px-2 py-1 rounded-md border ${
                count > 0 ? 'border-[color:var(--class-color)]/20 bg-[color:var(--class-color)]/[0.04] text-[color:var(--class-color)]' : 'border-white/[0.06] text-gray-600'
              }`}>
                {d.length > 15 ? d.slice(0, 15) + '...' : d} {count > 0 && <span className="font-bold">({count})</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* Keystone list */}
      {sorted.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Available Keys ({keys.length})</h3>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {sorted.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group">
                <span className="text-sm font-bold text-[color:var(--class-color)] tabular-nums w-10">+{k.level}</span>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[k.class] ?? '#888' }} />
                <span className="text-sm font-medium text-gray-200 w-28 truncate">{k.player}</span>
                <span className="text-xs text-gray-400 flex-1">{k.dungeon}</span>
                <button onClick={() => removeKey(k.id)} className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[10px]">{'\u2715'}</button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card><div className="text-center py-16 space-y-3">
          <p className="text-3xl text-gray-700">{'\uD83D\uDD11'}</p>
          <p className="text-gray-500">No keystones tracked yet</p>
        </div></Card>
      )}
    </div>
  )
}
