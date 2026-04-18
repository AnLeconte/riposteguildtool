import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface VaultChoice { slot: number; source: string; ilvl: number; dpsGain: number; itemName?: string }

const VAULT_ILVL = {
  // M+ vault ilvl by key level (TWW/Midnight S1)
  mythicPlus: { 2: 242, 3: 242, 4: 245, 5: 245, 6: 249, 7: 252, 8: 252, 9: 255, 10: 255, 11: 259, 12: 262 } as Record<number, number>,
  // Raid vault ilvl by difficulty
  raid: { normal: 249, heroic: 262, mythic: 275 } as Record<string, number>,
}

export function VaultOptimizerPage() {
  const [sims, setSims] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // M+ keys done this week (manual input)
  const [keysDone, setKeysDone] = useState<number[]>([])
  const [newKey, setNewKey] = useState('')

  // Raid bosses killed (manual)
  const [raidKills, setRaidKills] = useState({ normal: 0, heroic: 0, mythic: 0 })

  useEffect(() => {
    setLoading(true)
    api.getHistory(20).then((data) => {
      setSims(data.filter((s: any) => s.sim_type === 'droptimizer' && s.status === 'completed'))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const addKey = () => {
    const level = parseInt(newKey, 10)
    if (level >= 2 && level <= 30) {
      setKeysDone((prev) => [...prev, level].sort((a, b) => b - a))
      setNewKey('')
    }
  }

  const removeKey = (idx: number) => setKeysDone((prev) => prev.filter((_, i) => i !== idx))

  // Calculate vault slots
  const mplusSlots = [1, 4, 8].map((threshold) => {
    const eligible = keysDone.length >= threshold
    const bestKeys = keysDone.slice(0, threshold)
    const lowestOfBest = bestKeys[bestKeys.length - 1] ?? 0
    const ilvl = VAULT_ILVL.mythicPlus[Math.min(lowestOfBest, 12)] ?? 0
    return { threshold, eligible, ilvl, keys: bestKeys.length }
  })

  const raidSlots = [2, 4, 6].map((threshold) => {
    const totalKills = raidKills.normal + raidKills.heroic + raidKills.mythic
    const eligible = totalKills >= threshold
    // Best difficulty
    const bestDiff = raidKills.mythic > 0 ? 'mythic' : raidKills.heroic > 0 ? 'heroic' : 'normal'
    const ilvl = eligible ? (VAULT_ILVL.raid[bestDiff] ?? 0) : 0
    return { threshold, eligible, ilvl, kills: totalKills, difficulty: bestDiff }
  })

  const unlockedSlots = [...mplusSlots, ...raidSlots].filter((s) => s.eligible)

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Vault" highlight="Optimizer" description="See what your Great Vault rewards will be" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* M+ keys input */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">M+ Keys This Week</h3>
          <div className="flex gap-2">
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} type="number" min={2} max={30}
              placeholder="+Level" className="w-20 rounded-lg bg-wow-darker/80 border border-white/[0.08] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-wow-gold/30"
              onKeyDown={(e) => e.key === 'Enter' && addKey()} />
            <Button onClick={addKey} size="sm" variant="secondary">Add Key</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keysDone.map((k, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-[color:var(--class-color)] bg-[color:var(--class-color)]/10 border border-[color:var(--class-color)]/20">
                +{k}
                <button onClick={() => removeKey(i)} className="text-[color:var(--class-color)]/40 hover:text-red-400 text-[8px] ml-0.5">&#10005;</button>
              </span>
            ))}
            {keysDone.length === 0 && <p className="text-gray-600 text-xs">No keys entered</p>}
          </div>
        </Card>

        {/* Raid kills input */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Raid Bosses Killed</h3>
          <div className="space-y-2">
            {(['normal', 'heroic', 'mythic'] as const).map((diff) => (
              <div key={diff} className="flex items-center justify-between">
                <span className="text-xs text-gray-400 capitalize">{diff}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setRaidKills((p) => ({ ...p, [diff]: Math.max(0, p[diff] - 1) }))}
                    className="w-6 h-6 rounded border border-white/[0.08] text-gray-500 hover:text-white text-xs">-</button>
                  <span className="text-sm font-bold text-gray-300 w-6 text-center tabular-nums">{raidKills[diff]}</span>
                  <button onClick={() => setRaidKills((p) => ({ ...p, [diff]: p[diff] + 1 }))}
                    className="w-6 h-6 rounded border border-white/[0.08] text-gray-500 hover:text-white text-xs">+</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Vault Preview */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Great Vault Preview</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* M+ slots */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Mythic+ Slots</p>
            {mplusSlots.map((slot, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                slot.eligible ? 'border-[color:var(--class-color)]/30 bg-[color:var(--class-color)]/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                <div>
                  <span className="text-xs font-medium text-gray-300">Slot {i + 1}</span>
                  <span className="text-[10px] text-gray-600 ml-2">{slot.threshold} dungeons</span>
                </div>
                {slot.eligible ? (
                  <span className="text-sm font-bold text-[color:var(--class-color)]">{slot.ilvl} ilvl</span>
                ) : (
                  <span className="text-xs text-gray-600">Locked ({keysDone.length}/{slot.threshold})</span>
                )}
              </div>
            ))}
          </div>

          {/* Raid slots */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Raid Slots</p>
            {raidSlots.map((slot, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                slot.eligible ? 'border-purple-500/30 bg-purple-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                <div>
                  <span className="text-xs font-medium text-gray-300">Slot {i + 1}</span>
                  <span className="text-[10px] text-gray-600 ml-2">{slot.threshold} bosses</span>
                </div>
                {slot.eligible ? (
                  <div className="text-right">
                    <span className="text-sm font-bold text-purple-400">{slot.ilvl} ilvl</span>
                    <span className="text-[9px] text-gray-600 ml-1 capitalize">({slot.difficulty})</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-600">Locked ({slot.kills}/{slot.threshold})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Summary */}
      {unlockedSlots.length > 0 && (
        <Card className="p-4">
          <p className="text-sm text-gray-300">
            You'll have <span className="font-bold text-[color:var(--class-color)]">{unlockedSlots.length}</span> vault choices this week.
            Best possible ilvl: <span className="font-bold text-[color:var(--class-color)]">{Math.max(...unlockedSlots.map((s) => s.ilvl))}</span>
          </p>
        </Card>
      )}
    </div>
  )
}
