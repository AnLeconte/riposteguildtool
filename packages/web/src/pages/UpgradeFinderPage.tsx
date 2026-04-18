import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ItemLink } from '@/components/ui/ItemLink'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface UpgradeItem {
  name: string
  itemId: number
  slot: string
  ilvl: number
  dpsGain: number
  dpsPct: number
  source: string
  sourceType: 'raid' | 'dungeon' | 'unknown'
  iconUrl?: string
}

const SLOT_LABELS: Record<string, string> = {
  head: 'Head', neck: 'Neck', shoulders: 'Shoulders', back: 'Back', chest: 'Chest',
  wrists: 'Wrists', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet',
  finger1: 'Ring', finger2: 'Ring', trinket1: 'Trinket', trinket2: 'Trinket',
  main_hand: 'Weapon', off_hand: 'Off Hand',
}

export function UpgradeFinderPage() {
  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [slotFilter, setSlotFilter] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  // Load all droptimizer results and merge
  useEffect(() => {
    const load = async () => {
      try {
        const sims = await api.getHistory(50)
        const dropSims = sims.filter((s: any) => s.sim_type === 'droptimizer' && s.status === 'completed')

        const allUpgrades: UpgradeItem[] = []

        for (const sim of dropSims.slice(0, 5)) { // last 5 droptimizer runs
          try {
            const full = await api.getSimulation(sim.id)
            const items = full.sim_options?.items as any[] ?? []
            const results = full.profileset_results as any[] ?? []
            const instances = full.sim_options?.instances as any[] ?? []

            const resultMap = new Map<string, any>()
            for (const r of results) resultMap.set(r.name, r)

            for (const item of items) {
              const key = `${item.boss_name} - ${item.name} (${item.item_level})`
              const result = resultMap.get(key)
              if (!result || (result.dps_delta ?? 0) <= 0) continue

              // Dedupe by item id + slot
              if (allUpgrades.some((u) => u.itemId === item.id && u.slot === item.slot)) continue

              const instanceName = instances?.find((i: any) =>
                i.name && item.boss_name
              )?.name ?? ''

              allUpgrades.push({
                name: item.name,
                itemId: item.id,
                slot: item.slot,
                ilvl: item.item_level,
                dpsGain: result.dps_delta ?? 0,
                dpsPct: result.dps_delta_pct ?? 0,
                source: item.boss_name,
                sourceType: instanceName ? 'raid' : 'dungeon',
                iconUrl: item.icon_url,
              })
            }
          } catch { /* skip */ }
        }

        allUpgrades.sort((a, b) => b.dpsGain - a.dpsGain)
        setUpgrades(allUpgrades)
      } catch { /* skip */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const slots = [...new Set(upgrades.map((u) => u.slot))]
  const sources = [...new Set(upgrades.map((u) => u.source))]

  const filtered = upgrades.filter((u) => {
    if (slotFilter && u.slot !== slotFilter) return false
    if (sourceFilter && u.source !== sourceFilter) return false
    return true
  })

  const maxDps = filtered[0]?.dpsGain ?? 1

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Upgrade" highlight="Finder" description="All your best upgrades from every source, ranked" />
      </div>

      {loading ? (
        <Card><div className="text-center py-12"><div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" /><p className="text-gray-500 text-sm mt-3">Analyzing droptimizer results...</p></div></Card>
      ) : upgrades.length === 0 ? (
        <Card><div className="text-center py-16 space-y-3">
          <p className="text-3xl text-gray-700">&#128269;</p>
          <p className="text-gray-500">No upgrades found</p>
          <p className="text-gray-600 text-xs">Run a Droptimizer sim first, then come back here</p>
        </div></Card>
      ) : (
        <>
          {/* Summary */}
          <div className="flex gap-4 flex-wrap">
            <Card className="p-4 flex-1 min-w-[140px]">
              <p className="text-2xl font-bold text-green-400">{upgrades.length}</p>
              <p className="text-[10px] text-gray-500 uppercase">Total Upgrades</p>
            </Card>
            <Card className="p-4 flex-1 min-w-[140px]">
              <p className="text-2xl font-bold text-[color:var(--class-color)]">+{Math.round(upgrades[0]?.dpsGain ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-gray-500 uppercase">Best Upgrade DPS</p>
            </Card>
            <Card className="p-4 flex-1 min-w-[140px]">
              <p className="text-2xl font-bold text-gray-400">{slots.length}</p>
              <p className="text-[10px] text-gray-500 uppercase">Slots to Upgrade</p>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSlotFilter(null)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${!slotFilter ? 'bg-[color:var(--class-color)]/10 text-[color:var(--class-color)] border-[color:var(--class-color)]/30' : 'text-gray-500 border-transparent hover:border-white/[0.08]'}`}>
              All Slots
            </button>
            {slots.map((s) => (
              <button key={s} onClick={() => setSlotFilter(slotFilter === s ? null : s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${slotFilter === s ? 'bg-[color:var(--class-color)]/10 text-[color:var(--class-color)] border-[color:var(--class-color)]/30' : 'text-gray-500 border-transparent hover:border-white/[0.08]'}`}>
                {SLOT_LABELS[s] ?? s}
              </button>
            ))}
          </div>

          {/* Upgrade list */}
          <div className="space-y-1.5">
            {filtered.slice(0, 30).map((u, i) => {
              const barPct = Math.round((u.dpsGain / maxDps) * 100)
              return (
                <div key={`${u.itemId}-${u.slot}-${i}`} className="relative px-4 py-3 rounded-xl border border-white/[0.04] bg-wow-panel/40 hover:border-white/[0.08] transition-all">
                  <div className="absolute inset-y-0 left-0 rounded-xl bg-green-500/[0.04]" style={{ width: `${barPct}%` }} />
                  <div className="relative flex items-center gap-3">
                    <span className="text-[10px] text-gray-600 w-5 text-right tabular-nums">{i + 1}</span>
                    <span className="text-[9px] font-medium text-gray-500 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded w-14 text-center flex-shrink-0">
                      {SLOT_LABELS[u.slot] ?? u.slot}
                    </span>
                    <div className="flex-1 min-w-0">
                      <ItemLink itemId={u.itemId} name={u.name} ilvl={u.ilvl} iconUrl={u.iconUrl}
                        className="text-sm font-medium text-gray-200 hover:text-[color:var(--class-color)] transition-colors truncate" />
                      <p className="text-[10px] text-gray-600">{u.source} — ilvl {u.ilvl}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-400 tabular-nums">+{Math.round(u.dpsGain).toLocaleString()}</p>
                      <p className="text-[10px] text-green-600 tabular-nums">+{u.dpsPct.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
