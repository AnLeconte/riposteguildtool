import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

const DUNGEONS = [
  'Windrunner Spire', 'Murder Row', 'Den of Nalorakk', 'Maisara Caverns',
  "Magisters' Terrace", 'Pit of Saron', 'Seat of the Triumvirate', 'Skyreach',
]

// Approximate score per key level per dungeon (simplified scoring)
function scoreForKey(level: number, timed: boolean): number {
  if (level <= 0) return 0
  const base = level * 25
  return timed ? base : Math.round(base * 0.8)
}

interface DungeonScore {
  dungeon: string
  fortLevel: number
  fortTimed: boolean
  tyrLevel: number
  tyrTimed: boolean
}

const STORAGE_KEY = 'mplus-goals'
function loadScores(): DungeonScore[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as DungeonScore[]
    if (saved.length === DUNGEONS.length) return saved
    return DUNGEONS.map((d) => ({ dungeon: d, fortLevel: 0, fortTimed: true, tyrLevel: 0, tyrTimed: true }))
  } catch {
    return DUNGEONS.map((d) => ({ dungeon: d, fortLevel: 0, fortTimed: true, tyrLevel: 0, tyrTimed: true }))
  }
}

export function MplusGoalPage() {
  const [scores, setScores] = useState<DungeonScore[]>(loadScores)
  const [targetScore, setTargetScore] = useState('2500')

  const save = (updated: DungeonScore[]) => {
    setScores(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const update = (idx: number, field: keyof DungeonScore, value: any) => {
    const updated = scores.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    save(updated)
  }

  const totalScore = scores.reduce((sum, s) => {
    return sum + scoreForKey(s.fortLevel, s.fortTimed) + scoreForKey(s.tyrLevel, s.tyrTimed)
  }, 0)

  const target = parseInt(targetScore, 10) || 0
  const remaining = Math.max(0, target - totalScore)
  const progress = target > 0 ? Math.min((totalScore / target) * 100, 100) : 0

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="M+ Score" highlight="Goal" description="Track your Mythic+ score and plan what keys to push" />
      </div>

      {/* Target & current */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-orange-400">{totalScore}</p>
          <p className="text-[10px] text-gray-500 uppercase">Current Score</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-[10px] text-gray-500 uppercase mb-1">Target Score</p>
          <Input value={targetScore} onChange={(e) => setTargetScore(e.target.value)} type="number"
            className="text-center text-2xl font-bold text-[color:var(--class-color)] bg-transparent border-0 focus:ring-0 p-0" />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-gray-400">{remaining}</p>
          <p className="text-[10px] text-gray-500 uppercase">Remaining</p>
        </Card>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-wow-darker rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-orange-500 to-wow-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Dungeon table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-gray-300">Keys Per Dungeon</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase text-gray-600">Dungeon</th>
              <th className="text-center px-2 py-2 text-[10px] font-semibold uppercase text-gray-600" colSpan={2}>Fortified</th>
              <th className="text-center px-2 py-2 text-[10px] font-semibold uppercase text-gray-600" colSpan={2}>Tyrannical</th>
              <th className="text-center px-2 py-2 text-[10px] font-semibold uppercase text-gray-600">Score</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => {
              const dungeonScore = scoreForKey(s.fortLevel, s.fortTimed) + scoreForKey(s.tyrLevel, s.tyrTimed)
              return (
                <tr key={s.dungeon} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-gray-200 font-medium">{s.dungeon}</td>
                  <td className="px-1 py-2.5 text-center">
                    <input type="number" min={0} max={30} value={s.fortLevel || ''} onChange={(e) => update(i, 'fortLevel', parseInt(e.target.value) || 0)}
                      placeholder="—" className="w-12 bg-transparent text-center text-xs text-gray-300 border-b border-white/[0.08] focus:border-[color:var(--class-color)]/40 focus:outline-none tabular-nums" />
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    <button onClick={() => update(i, 'fortTimed', !s.fortTimed)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${s.fortTimed ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                      {s.fortTimed ? 'Timed' : 'Dep'}
                    </button>
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    <input type="number" min={0} max={30} value={s.tyrLevel || ''} onChange={(e) => update(i, 'tyrLevel', parseInt(e.target.value) || 0)}
                      placeholder="—" className="w-12 bg-transparent text-center text-xs text-gray-300 border-b border-white/[0.08] focus:border-[color:var(--class-color)]/40 focus:outline-none tabular-nums" />
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    <button onClick={() => update(i, 'tyrTimed', !s.tyrTimed)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${s.tyrTimed ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                      {s.tyrTimed ? 'Timed' : 'Dep'}
                    </button>
                  </td>
                  <td className="px-2 py-2.5 text-center text-xs font-bold text-orange-400 tabular-nums">{dungeonScore || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
